import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import { getInstagramAccountId } from "../utils/instagram.js";
import { completeOAuthFlow, getOAuthLoginUrl } from "../utils/oauth.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_STORY } = process.env;

const createStoryContainer = async (igAccountId, imageUrl, pageToken) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${igAccountId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          media_type: "STORIES",
          access_token: pageToken,
        },
      }
    );

    const containerId = response.data.id;
    console.log(`Story container created: ${containerId}`);
    return containerId;
  } catch (error) {
    console.error(`Error creating story container: ${error.response?.data || error.message}`);
    throw error;
  }
};

const publishStory = async (igAccountId, containerId, pageToken) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${igAccountId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: pageToken,
        },
      }
    );

    const storyId = response.data.id;
    console.log(`Story published: ${storyId}`);
    return storyId;
  } catch (error) {
    console.error(`Error publishing story: ${error.response?.data || error.message}`);
    throw error;
  }
};

const postToInstagramStory = async (pageId, pageToken, imageUrl) => {
  try {
    const igAccountId = await getInstagramAccountId(pageId, pageToken);
    const containerId = await createStoryContainer(igAccountId, imageUrl, pageToken);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const storyId = await publishStory(igAccountId, containerId, pageToken);
    return storyId;
  } catch (error) {
    console.error(`Error posting to Instagram story: ${error.message}`);
    throw error;
  }
};

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_STORY);
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { pageId, pageName, pageToken } = await completeOAuthFlow(
      code,
      REDIRECT_URI_STORY
    );

    const imageUrl = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1080&h=1920&fit=crop";

    console.log("Posting to Instagram Story directly...");
    const storyId = await postToInstagramStory(pageId, pageToken, imageUrl);

    res.json({
      success: true,
      pageId,
      pageName,
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

router.post("/post", async (req, res) => {
  const { pageId, pageToken, imageUrl } = req.body;

  if (!pageId || !pageToken || !imageUrl) {
    return res.status(400).json({
      error: "Missing required fields: pageId, pageToken, imageUrl",
    });
  }

  try {
    console.log("Starting Instagram Story post...");
    const storyId = await postToInstagramStory(pageId, pageToken, imageUrl);

    res.json({
      success: true,
      storyId,
      message: "Successfully posted to Instagram Story!",
    });
  } catch (error) {
    console.error(`Error posting story: ${error.response?.data || error.message}`);
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

export default router;