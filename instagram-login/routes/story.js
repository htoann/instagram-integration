import dotenv from "dotenv";
import express from "express";
import { postToInstagramStory } from "../utils/instagram.js";
import { getOAuthLoginUrl } from "../utils/oauth.js";
import {
  getInstagramMe,
  handleApiError
} from "../utils/routeHelpers.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_STORY } = process.env;

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_STORY);
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { userId, username, accessToken } = await completeOAuthFlow(code, REDIRECT_URI_STORY);
    return sendOAuthPopup(
      res,
      "instagram_oauth_success",
      { accessToken, userId, username },
      "Login successful. You can close this window."
    );
  } catch (error) {
    console.error(`Error in message callback: ${error.response?.data || error.message}`);
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
  const { imageUrl } = req.body || {};

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      error: "imageUrl is required"
    });
  }

  try {
    const { id: userId, username } = await getInstagramMe(accessToken);
    const storyId = await postToInstagramStory(userId, accessToken, imageUrl);

    res.json({
      success: true,
      userId,
      username,
      storyId,
      imageUrl
    });
  } catch (error) {
    console.error(`Error posting story via /story/post: ${error.response?.data || error.message}`);
    handleApiError(res, error);
  }
});

export default router;