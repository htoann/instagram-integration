import dotenv from "dotenv";
import express from "express";
import { postToInstagramStory } from "../utils/instagram.js";
import { completeOAuthFlow, getOAuthLoginUrl } from "../utils/oauth.js";

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
    const { userId, username, accessToken } = await completeOAuthFlow(
      code,
      REDIRECT_URI_STORY
    );

    const imageUrl = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1080&h=1920&fit=crop";

    console.log("Posting to Instagram Story...");
    const storyId = await postToInstagramStory(userId, accessToken, imageUrl);

    res.json({
      success: true,
      userId,
      username,
      storyId,
      message: "Successfully posted to Instagram Story!",
      imageUrl
    });
  } catch (error) {
    console.error(`Error in story callback: ${error.response?.data || error.message}`);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

export default router;