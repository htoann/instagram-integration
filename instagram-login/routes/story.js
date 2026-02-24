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