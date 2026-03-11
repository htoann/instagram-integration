import dotenv from "dotenv";
import express from "express";
import { postToInstagramFeed } from "../utils/instagram.js";
import { completeOAuthFlow, getOAuthLoginUrl } from "../utils/oauth.js";
import {
  getInstagramMe,
  handleApiError,
  sendOAuthPopup
} from "../utils/routeHelpers.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_FEED } = process.env;

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_FEED);
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { userId, username, accessToken } = await completeOAuthFlow(
      code,
      REDIRECT_URI_FEED
    );
    return sendOAuthPopup(
      res,
      "instagram_oauth_success",
      { accessToken, userId, username },
      "Login successful. You can close this window."
    );
  } catch (error) {
    console.error(`Error in feed callback: ${error.response?.data || error.message}`);
    return sendOAuthPopup(
      res,
      "instagram_oauth_error",
      { error: error.response?.data || error.message || "Unknown error" },
      "Login failed. You can close this window."
    );
  }
});

router.post("/post", async (req, res) => {
  const accessToken = req.accessToken;
  const { imageUrl, caption } = req.body || {};

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      error: "imageUrl is required"
    });
  }

  try {
    const { id: userId, username } = await getInstagramMe(accessToken);
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
    console.error(`Error posting feed via /feed/post: ${error.response?.data || error.message}`);
    handleApiError(res, error);
  }
});

export default router;
