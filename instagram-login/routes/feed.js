import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import { postToInstagramFeed } from "../utils/instagram.js";
import { completeOAuthFlow, getOAuthLoginUrl } from "../utils/oauth.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_FEED } = process.env;

router.get("/login", (req, res) => {
  const mode = req.query.mode === "token" ? "token" : "";
  const url = getOAuthLoginUrl(REDIRECT_URI_FEED, mode);
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  try {
    const { userId, username, accessToken } = await completeOAuthFlow(
      code,
      REDIRECT_URI_FEED
    );

    if (state === "token") {
      return res.send(`<!doctype html>
<html>
  <body>
    <script>
      (function () {
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "instagram_oauth_success",
              accessToken: ${JSON.stringify(accessToken)},
              userId: ${JSON.stringify(userId)},
              username: ${JSON.stringify(username)}
            },
            "*"
          );
        }
        window.close();
      })();
    </script>
    <p>Login successful. You can close this window.</p>
  </body>
</html>`);
    }

    const imageUrl = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1080&h=1080&fit=crop";
    const caption = "Posted automatically via Instagram Login integration";

    const mediaId = await postToInstagramFeed(
      userId,
      accessToken,
      imageUrl,
      caption
    );

    res.json({
      success: true,
      userId,
      username,
      mediaId,
      message: "Successfully posted to Instagram feed!",
      imageUrl,
      caption
    });
  } catch (error) {
    console.error(`Error in feed callback: ${error.response?.data || error.message}`);

    if (req.query.state === "token") {
      return res.send(`<!doctype html>
<html>
  <body>
    <script>
      (function () {
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "instagram_oauth_error",
              error: ${JSON.stringify(error.response?.data || error.message || "Unknown error")}
            },
            "*"
          );
        }
        window.close();
      })();
    </script>
    <p>Login failed. You can close this window.</p>
  </body>
</html>`);
    }

    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

router.post("/post", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const { imageUrl, caption } = req.body || {};

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      error: "Missing or invalid Authorization header. Use Bearer <token>."
    });
  }

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      error: "imageUrl is required"
    });
  }

  try {
    const meResponse = await axios.get("https://graph.instagram.com/me", {
      params: {
        fields: "id,username",
        access_token: accessToken
      }
    });

    const { id: userId, username } = meResponse.data;
    const mediaId = await postToInstagramFeed(
      userId,
      accessToken,
      imageUrl,
      caption || ""
    );

    res.json({
      success: true,
      userId,
      username,
      mediaId,
      imageUrl,
      caption: caption || ""
    });
  } catch (error) {
    const graphError = error.response?.data?.error;
    const isTokenExpired = graphError?.code === 190;

    if (isTokenExpired) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        reauth: true,
        error: graphError.message || "Instagram access token expired or invalid. Please login again."
      });
    }

    console.error(`Error posting feed via /feed/post: ${error.response?.data || error.message}`);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

export default router;