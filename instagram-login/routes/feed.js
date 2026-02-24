import dotenv from "dotenv";
import express from "express";
import { postToInstagramFeed } from "../utils/instagram.js";
import { getOAuthLoginUrl } from "../utils/oauth.js";
import {
  getInstagramMe,
  handleApiError
} from "../utils/routeHelpers.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_FEED } = process.env;

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_FEED);
  res.redirect(url);
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
