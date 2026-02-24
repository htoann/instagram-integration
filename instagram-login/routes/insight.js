import dotenv from "dotenv";
import express from "express";
import { getInstagramPosts } from "../utils/instagram.js";
import { getOAuthLoginUrl } from "../utils/oauth.js";
import {
  getInstagramMe,
  handleApiError
} from "../utils/routeHelpers.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_INSIGHT } = process.env;

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_INSIGHT);
  res.redirect(url);
});

router.get("/insights", async (req, res) => {
  const accessToken = req.accessToken;

  try {
    const { id: userId, username } = await getInstagramMe(accessToken);

    const posts = await getInstagramPosts(userId, accessToken);

    res.json({
      success: true,
      userId,
      username,
      totalPosts: posts.length,
      posts: posts.slice(0, 5).map(post => ({
        id: post.id,
        caption: post.caption || "No caption",
        media_type: post.media_type,
        timestamp: post.timestamp,
        permalink: post.permalink,
        like_count: post.like_count || 0,
        comments_count: post.comments_count || 0,
      })),
      message: "Successfully retrieved Instagram post insights!",
    });
  } catch (error) {
    console.error(`Error getting insights via /insight/insights: ${error.response?.data || error.message}`);
    handleApiError(res, error);
  }
});

export default router;