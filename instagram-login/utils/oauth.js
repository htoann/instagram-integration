import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const { APP_ID, APP_SECRET } = process.env;

const OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights"
].join(",");

const getOAuthLoginUrl = (redirectUri) => {
  return (
    `https://www.instagram.com/oauth/authorize` +
    `?client_id=${APP_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${OAUTH_SCOPES}`
  );
};

const exchangeCodeForToken = async (code, redirectUri) => {
  console.log("Exchanging code for access token");
  const tokenRes = await axios.post(
    "https://api.instagram.com/oauth/access_token",
    new URLSearchParams({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return {
    accessToken: tokenRes.data.access_token,
    userId: tokenRes.data.user_id
  };
};

const exchangeForLongLivedToken = async (shortLivedToken) => {
  console.log("Exchanging for long-lived token");
  const response = await axios.get(
    "https://graph.instagram.com/access_token",
    {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: APP_SECRET,
        access_token: shortLivedToken
      }
    }
  );

  return response.data.access_token;
};

const getInstagramUserProfile = async (userId, accessToken) => {
  console.log("Getting Instagram user profile");
  console.log("User ID:", userId);
  const response = await axios.get(
    `https://graph.instagram.com/me`,
    {
      params: {
        fields: 'id,username,account_type,media_count',
        access_token: accessToken
      }
    }
  );

  console.log(`Instagram User: ${response.data.username} (${response.data.account_type})`);
  console.log("Full profile data:", response.data);
  return response.data;
};

const completeOAuthFlow = async (code, redirectUri) => {
  const { accessToken: shortLivedToken, userId } = await exchangeCodeForToken(code, redirectUri);
  const accessToken = await exchangeForLongLivedToken(shortLivedToken);
  const userProfile = await getInstagramUserProfile(userId, accessToken);

  console.log('✅ Token received');
  return {
    userId: userProfile.id,
    username: userProfile.username,
    accessToken,
    accountType: userProfile.account_type,
  };
};

export {
  completeOAuthFlow,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getInstagramUserProfile,
  getOAuthLoginUrl,
  OAUTH_SCOPES
};

