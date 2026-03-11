import axios from "axios";

export const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
};

export const getInstagramMe = async (accessToken) => {
  const { data } = await axios.get("https://graph.instagram.com/me", {
    params: {
      fields: "id,username",
      access_token: accessToken,
    },
  });

  return data;
};

export const isTokenExpiredError = (error) => error.response?.data?.error?.code === 190;

export const sendTokenExpired = (res, fallbackMessage) =>
  res.status(401).json({
    success: false,
    code: "TOKEN_EXPIRED",
    reauth: true,
    error: fallbackMessage || "Instagram access token expired or invalid. Please login again.",
  });

export const sendAuthHeaderMissing = (res) =>
  res.status(401).json({
    success: false,
    error: "Missing access token. Use Authorization: Bearer <token> or ?access_token=<token>.",
  });

export const sendServerError = (res, error) =>
  res.status(500).json({
    success: false,
    error: error.response?.data || error.message,
  });

export const handleApiError = (res, error) => {
  if (isTokenExpiredError(error)) {
    sendTokenExpired(res, error.response?.data?.error?.message);
    return true;
  }

  sendServerError(res, error);
  return false;
};

export const requireBearerToken = (req, res) => {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    sendAuthHeaderMissing(res);
    return null;
  }

  return accessToken;
};

export const sendOAuthPopup = (res, type, payload, statusText) => {
  const safeType = JSON.stringify(type);
  const safePayload = JSON.stringify(payload);

  return res.send(`<!doctype html>
<html>
  <body>
    <script>
      (function () {
        if (window.opener) {
          window.opener.postMessage(
            Object.assign({ type: ${safeType} }, ${safePayload}),
            "*"
          );
        }
        window.close();
      })();
    </script>
    <p>${statusText}</p>
  </body>
</html>`);
};

const isPublicRoute = (req) => {
  const method = String(req.method || "").toUpperCase();
  const rawPath = String(req.path || "");
  const path = rawPath === "/" ? "/" : rawPath.replace(/\/+$/, "");

  if (method === "OPTIONS") return true;
  if (path === "/") return true;
  if (path === "/insight") return true;
  if (path === "/webhook") return true;
  if (path.endsWith("/login") || path.endsWith("/callback")) return true;
  if (path === "/message/stream") return true;

  return false;
};

export function requireAuth(req, res, next) {
  if (isPublicRoute(req)) {
    next();
    return;
  }

  const queryToken = String(req.query?.access_token || "").trim();
  if (queryToken) {
    req.accessToken = queryToken;
    next();
    return;
  }

  const accessToken = requireBearerToken(req, res);
  if (!accessToken) {
    return;
  }

  req.accessToken = accessToken;
  next();
}
