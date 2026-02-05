const express = require("express");
const { postToInstagramFeed } = require("../utils/instagram");
const { getOAuthLoginUrl, completeOAuthFlow } = require("../utils/oauth");

const router = express.Router();

const { REDIRECT_URI_FEED } = process.env;

/**
 * Login endpoint for Instagram feed posting
 */
router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_FEED);
  res.redirect(url);
});

/**
 * Callback endpoint after OAuth - posts to feed directly
 */
router.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { pageId, pageName, pageToken } = await completeOAuthFlow(
      code,
      REDIRECT_URI_FEED
    );

    // Post to feed directly
    // Use a reliable, publicly accessible image URL
    // Instagram requires: proper Content-Type headers, accessible without authentication, valid image format (JPG/PNG)
    const imageUrl = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1080&h=1080&fit=crop";
    const caption = "Posted automatically via Instagram integration";

    console.log("Posting to Instagram feed directly...");
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

    // Provide helpful error message for media URL issues
    let errorMessage = error.response?.data || error.message;
    if (error.response?.data?.error?.error_subcode === 2207052) {
      errorMessage = {
        ...error.response.data,
        hint: "Image URL must be publicly accessible, return proper headers, and be in JPG/PNG format. Try using URLs from: images.unsplash.com, i.imgur.com, or your own CDN."
      };
    }

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * Post to Instagram feed
 * POST /feed/post
 * Body: { pageId, pageToken, imageUrl, caption }
 */
router.post("/post", async (req, res) => {
  const { pageId, pageToken, imageUrl, caption } = req.body;

  if (!pageId || !pageToken || !imageUrl) {
    return res.status(400).json({
      error: "Missing required fields: pageId, pageToken, imageUrl",
    });
  }

  // Validate image URL format
  if (!imageUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png)(\?.*)?$/i) && !imageUrl.includes('unsplash.com') && !imageUrl.includes('imgur.com')) {
    return res.status(400).json({
      error: "Image URL should end with .jpg, .jpeg, or .png, or use a trusted image service like Unsplash or Imgur",
      hint: "Instagram requires publicly accessible URLs with proper image headers"
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

    // Provide helpful error message for media URL issues
    let errorMessage = error.response?.data || error.message;
    if (error.response?.data?.error?.error_subcode === 2207052) {
      errorMessage = {
        ...error.response.data,
        hint: "Image URL must be publicly accessible, return proper headers, and be in JPG/PNG format. Try using URLs from: images.unsplash.com, i.imgur.com, or your own CDN."
      };
    }

    res.status(500).json({
      error: errorMessage,
    });
  }
});

module.exports = router;