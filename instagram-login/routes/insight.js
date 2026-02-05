import dotenv from "dotenv";
import express from "express";
import { commentOnInstagramPost, getInstagramPosts } from "../utils/instagram.js";
import { completeOAuthFlow, getOAuthLoginUrl } from "../utils/oauth.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_INSIGHT } = process.env;

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_INSIGHT);
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { userId, username, accessToken } = await completeOAuthFlow(
      code,
      REDIRECT_URI_INSIGHT
    );

    const posts = await getInstagramPosts(userId, accessToken);

    const firstPost = posts[0];
    console.log(`Retrieved first post: ${firstPost.id}`);

    // Comment on the first post
    const commentText = "Great post! 🔥";
    const commentResult = await commentOnInstagramPost(firstPost.id, commentText, accessToken);

    res.json({
      success: true,
      userId,
      username,
      retrievedPost: {
        id: firstPost.id,
        caption: firstPost.caption || "No caption",
        media_type: firstPost.media_type,
        timestamp: firstPost.timestamp,
        permalink: firstPost.permalink,
        like_count: firstPost.like_count || 0,
        comments_count: firstPost.comments_count || 0,
      },
      comment: {
        text: commentText,
        id: commentResult.id,
      },
      posts: posts.slice(0, 5).map(post => ({
        id: post.id,
        caption: post.caption || "No caption",
        media_type: post.media_type,
        timestamp: post.timestamp,
        like_count: post.like_count || 0,
        comments_count: post.comments_count || 0,
      })),
      message: "Successfully retrieved Instagram posts and commented on the first post!",
    });
  } catch (error) {
    console.error(`Error in insight callback: ${error.response?.data || error.message}`);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

export default router;