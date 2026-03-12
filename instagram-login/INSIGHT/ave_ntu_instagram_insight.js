// -----------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------
// const API_BASE_URL = "https://test-t96q.onrender.com";
const API_BASE_URL =
  // "https://testinsforcrm-fgh0cxbnfjf9f9az.australiasoutheast-01.azurewebsites.net";
  "https://azapp-eit-onentu-dev-gehnf7acbee2fub6.southeastasia-01.azurewebsites.net";
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const CONFIG = {
  endpoint: apiUrl("/insight"),
  loginEndpoint: apiUrl("/auth/insight/login"),
  tokenKey: "instagramInsightAccessToken",
};

// -----------------------------------------------------------------------
// DOM helpers
// -----------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  loginBtn: $("loginBtn"),
  logoutBtn: $("logoutBtn"),
  fetchBtn: $("fetchBtn"),
  statusBar: $("statusBar"),
  results: $("results"),
  accountCard: $("accountCard"),
  summaryGrid: $("summaryGrid"),
  postsBody: $("postsBody"),
  prospectsContainer: $("prospectsContainer"),
  rawJson: $("rawJson"),
};

const trustedOrigin = API_BASE_URL;
let pendingLogin = null;

// -----------------------------------------------------------------------
// Token helpers
// -----------------------------------------------------------------------
const getToken = () => localStorage.getItem(CONFIG.tokenKey);
const setToken = (t) => localStorage.setItem(CONFIG.tokenKey, t);
const clearToken = () => localStorage.removeItem(CONFIG.tokenKey);

// -----------------------------------------------------------------------
// UI helpers
// -----------------------------------------------------------------------
const escapeHtml = (str) => {
  const p = document.createElement("p");
  p.textContent = str;
  return p.innerHTML;
};

const showStatus = (message, type = "info") => {
  ui.statusBar.className = `status ${type}`;
  ui.statusBar.innerHTML = message;
  ui.statusBar.classList.remove("hidden");
};

const hideStatus = () => ui.statusBar.classList.add("hidden");

const renderAuthState = () => {
  const loggedIn = Boolean(getToken());
  ui.loginBtn.classList.toggle("hidden", loggedIn);
  ui.logoutBtn.classList.toggle("hidden", !loggedIn);
  ui.fetchBtn.disabled = !loggedIn;
};

const toErrorMessage = (e) => e?.message || e || "Unknown error";

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// -----------------------------------------------------------------------
// OAuth popup flow
// -----------------------------------------------------------------------
const completePendingLogin = (handler) => {
  if (!pendingLogin) return;
  const current = pendingLogin;
  pendingLogin = null;
  clearInterval(current.closeTimer);
  handler(current);
};

const openLoginPopup = () =>
  new Promise((resolve, reject) => {
    const popup = window.open(
      CONFIG.loginEndpoint + "?popup=1",
      "instagramInsightPopup",
      "width=520,height=720",
    );

    if (!popup) {
      reject(
        new Error("Popup blocked. Please allow popups and try again."),
      );
      return;
    }

    const closeTimer = setInterval(() => {
      if (!popup.closed) return;
      completePendingLogin(({ reject: r }) =>
        r(
          new Error(
            "Something went wrong.",
          ),
        ),
      );
    }, 400);

    pendingLogin = { resolve, reject, closeTimer };
  });

window.addEventListener("message", (event) => {
  if (event.origin !== trustedOrigin) return;
  const { type, accessToken, error } = event.data || {};

  if (type === "instagram_oauth_success" && accessToken) {
    setToken(accessToken);
    renderAuthState();
    completePendingLogin(({ resolve }) => resolve(accessToken));
    return;
  }
});

// -----------------------------------------------------------------------
// Tabs
// -----------------------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document
      .getElementById(`tab-${btn.dataset.tab}`)
      .classList.add("active");
  });
});

// -----------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------
const formatNumber = (n) => Number(n || 0).toLocaleString();

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const mediaTypeBadge = (type) => {
  const t = (type || "").toUpperCase();
  const cls =
    t === "IMAGE" ? "image" : t === "VIDEO" ? "video" : "carousel";
  return `<span class="badge ${cls}">${escapeHtml(t || "UNKNOWN")}</span>`;
};

const truncate = (str, len = 60) => {
  if (!str) return "—";
  return str.length > len ? str.slice(0, len) + "…" : str;
};

// -----------------------------------------------------------------------
// Render functions
// -----------------------------------------------------------------------
const renderAccount = (me) => {
  if (!me) {
    ui.accountCard.innerHTML = "<em>No account info</em>";
    return;
  }
  const profileUrl = me.username
    ? `https://www.instagram.com/${me.username}/`
    : "#";
  ui.accountCard.innerHTML = `
    <div class="account-info">
      <div class="avatar"></div>
      <div>
        <div class="username">
          <a href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener">
            @${escapeHtml(me.username || me.id)}
          </a>
        </div>
        <div class="userid">ID: ${escapeHtml(String(me.id))}</div>
      </div>
    </div>`;
};

const renderSummary = (summary) => {
  if (!summary) {
    ui.summaryGrid.innerHTML = "<em>No summary</em>";
    return;
  }
  const stats = [
    { label: "Total Posts", value: summary.total_posts },
    { label: "Total Likes", value: summary.total_likes },
    { label: "Total Comments", value: summary.total_comments },
    { label: "Total Engagement", value: summary.total_engagement },
    { label: "Unique Prospects", value: summary.unique_prospects },
  ];
  ui.summaryGrid.innerHTML = stats
    .map(
      (s) => `
    <div class="stat-card">
      <div class="value">${formatNumber(s.value)}</div>
      <div class="label">${escapeHtml(s.label)}</div>
    </div>`,
    )
    .join("");
};

const renderPosts = (posts) => {
  if (!posts || posts.length === 0) {
    ui.postsBody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;color:#605e5c;">No posts found.</td></tr>';
    return;
  }
  ui.postsBody.innerHTML = posts
    .map(
      (p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${mediaTypeBadge(p.media_type)}</td>
      <td class="caption-cell" title="${escapeHtml(p.caption || "")}">${escapeHtml(truncate(p.caption))}</td>
      <td>${formatNumber(p.like_count)}</td>
      <td>${formatNumber(p.comment_count)}</td>
      <td><strong>${formatNumber(p.total_engagement)}</strong></td>
      <td>${formatDate(p.timestamp)}</td>
      <td>${p.permalink ? `<a href="${escapeHtml(p.permalink)}" target="_blank" rel="noopener">View</a>` : "—"}</td>
    </tr>`,
    )
    .join("");
};

const renderProspects = (prospects) => {
  if (!prospects || prospects.length === 0) {
    ui.prospectsContainer.innerHTML =
      '<p style="text-align:center;color:#605e5c;">No prospects found.</p>';
    return;
  }
  ui.prospectsContainer.innerHTML = prospects
    .map((p) => {
      const nameHtml = p.profile_url
        ? `<a href="${escapeHtml(p.profile_url)}" target="_blank" rel="noopener">@${escapeHtml(p.username)}</a>`
        : escapeHtml(p.username || p.user_id || "Unknown");

      const interactionsHtml = (p.interactions || [])
        .map(
          (ix) => `
        <li>
          <span class="interaction-text">"${escapeHtml(truncate(ix.comment_text, 120))}"</span>
          <span class="interaction-meta">
            ${formatDateTime(ix.commented_at)}
            ${ix.post_permalink ? ` · <a href="${escapeHtml(ix.post_permalink)}" target="_blank" rel="noopener">on post</a>` : ""}
          </span>
        </li>`,
        )
        .join("");

      return `
      <div class="prospect-card">
        <div class="prospect-header">
          <span class="name">${nameHtml}</span>
          <span class="count">${p.total_interactions} interaction${p.total_interactions !== 1 ? "s" : ""}</span>
        </div>
        <ul class="interaction-list">${interactionsHtml}</ul>
      </div>`;
    })
    .join("");
};

// -----------------------------------------------------------------------
// Fetch insights from API
// -----------------------------------------------------------------------
const fetchInsights = async (token) => {
  const url = CONFIG.endpoint;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();
  const data = parseJson(text);

  return {
    res,
    data,
    isTokenExpired: res.status === 401 || data?.code === "TOKEN_EXPIRED",
  };
};

const displayResults = (data) => {
  renderAccount(data.me);
  renderSummary(data.summary);
  renderPosts(data.ranked_posts);
  renderProspects(data.prospects);
  ui.rawJson.textContent = JSON.stringify(data, null, 2);
  ui.results.classList.remove("hidden");
};

// -----------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------
ui.loginBtn.addEventListener("click", async () => {
  hideStatus();
  try {
    await openLoginPopup();
    showStatus(
      "Login successful! Click <strong>Fetch Insights</strong> to load data.",
      "success",
    );
  } catch (error) {
    showStatus(
      "Login failed: " + escapeHtml(toErrorMessage(error)),
      "error",
    );
  }
});

ui.logoutBtn.addEventListener("click", () => {
  clearToken();
  renderAuthState();
  ui.results.classList.add("hidden");
  hideStatus();
  showStatus("Logged out.", "info");
});

ui.fetchBtn.addEventListener("click", async () => {
  let token = getToken();
  if (!token) {
    showStatus("Please login first.", "error");
    return;
  }

  hideStatus();
  showStatus('<span class="spinner"></span> Fetching insights…', "info");
  ui.fetchBtn.disabled = true;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { res, data, isTokenExpired } = await fetchInsights(token);

      if (!isTokenExpired) {
        if (res.ok) {
          hideStatus();
          displayResults(data);
          showStatus(
            `Loaded <strong>${data.summary?.total_posts ?? 0}</strong> posts and <strong>${data.summary?.unique_prospects ?? 0}</strong> prospects.`,
            "success",
          );
        } else {
          showStatus(
            "API error: " + escapeHtml(JSON.stringify(data)),
            "error",
          );
        }
        ui.fetchBtn.disabled = false;
        return;
      }

      // Token expired
      clearToken();
      renderAuthState();

      if (attempt === 1) {
        showStatus(
          "Access token expired or invalid. Please login again.",
          "error",
        );
        ui.fetchBtn.disabled = false;
        return;
      }

      showStatus(
        '<span class="spinner"></span> Token expired. Re-authenticating…',
        "info",
      );

      try {
        token = await openLoginPopup();
        showStatus(
          '<span class="spinner"></span> Re-authenticated. Retrying…',
          "info",
        );
      } catch (err) {
        showStatus(
          "Re-login failed: " + escapeHtml(toErrorMessage(err)),
          "error",
        );
        ui.fetchBtn.disabled = false;
        return;
      }
    }
  } catch (error) {
    showStatus(
      "Request failed: " + escapeHtml(toErrorMessage(error)),
      "error",
    );
    ui.fetchBtn.disabled = false;
  }
});

// -----------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------
renderAuthState();
