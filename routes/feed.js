import dotenv from "dotenv";
import express from "express";
import { postToInstagramFeed } from "../utils/instagram.js";
import { completeOAuthFlow, getOAuthLoginUrl } from "../utils/oauth.js";

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
    const { pageId, pageName, pageToken } = await completeOAuthFlow(
      code,
      REDIRECT_URI_FEED
    );

    const imageUrl = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1080&h=1080&fit=crop";
    const caption = "Posted automatically via Instagram integration";

    const mediaId = await postToInstagramFeed(
      pageId,
      pageToken,
      imageUrl,
      caption
    );

    res.json({
      success: true,
      pageId,
      pageName,
      mediaId,
      message: "Successfully posted to Instagram feed!",
      imageUrl,
      caption
    });
  } catch (error) {
    console.error(`Error in feed callback: ${error.response?.data || error.message}`);
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

router.post("/post", async (req, res) => {
  const { pageId, pageToken, imageUrl, caption } = req.body;

  if (!pageId || !pageToken || !imageUrl) {
    return res.status(400).json({
      error: "Missing required fields: pageId, pageToken, imageUrl",
    });
  }

  try {
    console.log("Starting Instagram feed post...");
    const mediaId = await postToInstagramFeed(
      pageId,
      pageToken,
      imageUrl,
      caption || ""
    );

    res.json({
      success: true,
      mediaId,
      message: "Successfully posted to Instagram feed!",
    });
  } catch (error) {
    console.error(`Error posting to feed: ${error.response?.data || error.message}`);
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

export default router;