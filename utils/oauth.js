const axios = require("axios");

const { APP_ID, APP_SECRET } = process.env;

const OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_content_publish",
  "pages_read_engagement",
  "pages_show_list",
  "business_management",
].join(",");

/**
 * Generate OAuth login URL
 */
function getOAuthLoginUrl(redirectUri) {
  return (
    `https://www.facebook.com/v24.0/dialog/oauth` +
    `?client_id=${APP_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${OAUTH_SCOPES}`
  );
}

/**
 * Exchange authorization code for user access token
 */
async function exchangeCodeForToken(code, redirectUri) {
  console.log("Exchanging code for user token");
  const tokenRes = await axios.get(
    "https://graph.facebook.com/v24.0/oauth/access_token",
    {
      params: {
        client_id: APP_ID,
        client_secret: APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    }
  );

  return tokenRes.data.access_token;
}

/**
 * Get page accounts and tokens
 */
async function getPageAccounts(userToken) {
  console.log("Getting page accounts");
  const pagesRes = await axios.get(
    "https://graph.facebook.com/v24.0/me/accounts",
    { params: { access_token: userToken } }
  );

  const page = pagesRes.data.data[0];
  console.log(`PAGE_ID: ${page.id}`);

  return {
    pageId: page.id,
    pageName: page.name,
    pageToken: page.access_token,
  };
}

/**
 * Complete OAuth flow and return page credentials
 */
async function completeOAuthFlow(code, redirectUri) {
  const userToken = await exchangeCodeForToken(code, redirectUri);
  const pageData = await getPageAccounts(userToken);
  return pageData;
}

module.exports = {
  OAUTH_SCOPES,
  getOAuthLoginUrl,
  exchangeCodeForToken,
  getPageAccounts,
  completeOAuthFlow,
};
