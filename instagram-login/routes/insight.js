import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import { completeOAuthFlow, getOAuthLoginUrl } from "../utils/oauth.js";
import {
  getBearerToken,
  getInstagramMe,
  handleApiError,
  sendOAuthPopup,
} from "../utils/routeHelpers.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_INSIGHT } = process.env;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getRecentMedia = async (userId, accessToken, mediaLimit) => {
  const { data } = await axios.get(`https://graph.instagram.com/${userId}/media`, {
    params: {
      fields:
        "id,caption,media_type,permalink,timestamp,like_count,comments_count",
      limit: mediaLimit,
      access_token: accessToken,
    },
  });

  return data || {};
};

const getMediaComments = async (mediaId, accessToken, commentLimit) => {
  const { data } = await axios.get(`https://graph.instagram.com/${mediaId}/comments`, {
    params: {
      fields: "id,text,username,timestamp,from",
      limit: commentLimit,
      access_token: accessToken,
    },
  });

  return data || {};
};

const getAccessTokenFromRequest = (req) => {
  const queryToken = String(req.query.access_token || "").trim();
  if (queryToken) return queryToken;
  return getBearerToken(req);
};

const createState = (payload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const parseState = (rawState) => {
  try {
    const decoded = Buffer.from(String(rawState || ""), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const toQueryString = (query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
};

router.get("/login", (req, res) => {
  const mediaLimit = 50;
  const commentLimit = Math.min(toPositiveInt(req.query.commentLimit, 20), 50);
  const raw = String(req.query.raw || "") === "1" ? "1" : "0";
  const popup = String(req.query.popup || "") === "1" ? "1" : "0";

  const oauthUrl = getOAuthLoginUrl(
    REDIRECT_URI_INSIGHT,
    createState({ mediaLimit, commentLimit, raw, popup })
  );

  res.redirect(oauthUrl);
});

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const statePayload = parseState(state);
  const shouldUsePopup = String(req.query.popup || statePayload.popup || "") === "1";

  if (!code) {
    const errorPayload = { error: "Missing OAuth code" };

    if (shouldUsePopup) {
      return sendOAuthPopup(
        res,
        "instagram_oauth_error",
        errorPayload,
        "Login failed. You can close this window."
      );
    }

    return res.status(400).json({
      success: false,
      ...errorPayload,
    });
  }

  try {
    const { userId, username, accessToken } = await completeOAuthFlow(
      code,
      REDIRECT_URI_INSIGHT
    );

    if (shouldUsePopup) {
      return sendOAuthPopup(
        res,
        "instagram_oauth_success",
        {
          accessToken,
          userId,
          username,
          state: state || null,
        },
        "Login successful. You can close this window."
      );
    }

    const nextQuery = toQueryString({
      access_token: accessToken,
      mediaLimit: req.query.mediaLimit || statePayload.mediaLimit,
      commentLimit: req.query.commentLimit || statePayload.commentLimit,
      raw: req.query.raw || statePayload.raw,
    });

    return res.redirect(`${req.baseUrl}${nextQuery}`);
  } catch (error) {
    console.error(`Error in insight callback: ${error.response?.data || error.message}`);
    const errorPayload = {
      error: error.response?.data || error.message || "Unknown error",
    };

    if (shouldUsePopup) {
      return sendOAuthPopup(
        res,
        "instagram_oauth_error",
        errorPayload,
        "Login failed. You can close this window."
      );
    }

    return res.status(500).json({
      success: false,
      ...errorPayload,
    });
  }
});

// ---------------------------------------------------------------------------
// Build a client-friendly, lead-acquisition response:
//   1. rankedPosts  – posts sorted by total engagement (most interest first)
//   2. prospects    – unique users who commented, sorted by interaction count,
//                     with profile URL (contact channel) and the posts /
//                     comments they engaged with (interest signal)
//   3. summary      – aggregate numbers at a glance
// ---------------------------------------------------------------------------

const buildProspectMap = (rankedPosts, ownerUsername) => {
  /** @type {Map<string, {username:string, profileUrl:string, interactions:Array}>} */
  const map = new Map();

  for (const post of rankedPosts) {
    for (const c of post.comments) {
      // Resolve username: direct field → from.username → from.id fallback
      const username = c.username || c.from?.username || null;
      const userId = c.from?.id || null;

      // Skip comments with no identifiable user
      if (!username && !userId) continue;

      // Skip our own comments – we are not a prospect
      if (
        ownerUsername &&
        username?.toLowerCase() === ownerUsername.toLowerCase()
      ) {
        continue;
      }

      const key = username || userId;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          username: username || null,
          userId: userId || null,
          profileUrl: username
            ? `https://www.instagram.com/${username}/`
            : null,
          interactions: [],
        };
        map.set(key, entry);
      }

      entry.interactions.push({
        mediaId: post.mediaId,
        postCaption: post.caption,
        postPermalink: post.permalink,
        commentId: c.id,
        commentText: c.text,
        commentedAt: c.timestamp,
      });
    }
  }

  return map;
};

router.get("/", async (req, res) => {
  const mediaLimit = 50;
  const commentLimit = Math.min(
    toPositiveInt(req.query.commentLimit, 20),
    50
  );

  let accessToken = getAccessTokenFromRequest(req);

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      error: "Missing access token. Use Authorization: Bearer <token> or ?access_token=<token>.",
      loginUrl: `${req.baseUrl}/login`,
    });
  }

  try {
    const me = await getInstagramMe(accessToken);
    const userId = me?.id;

    // ---- Fetch media + comments in parallel per post ----
    const mediaResponse = await getRecentMedia(userId, accessToken, mediaLimit);
    const mediaItems = Array.isArray(mediaResponse?.data) ? mediaResponse.data : [];

    const commentResults = await Promise.all(
      mediaItems.map(async (media) => ({
        mediaId: media.id,
        comments: await getMediaComments(media.id, accessToken, commentLimit),
      }))
    );

    // ---- Build ranked posts (sorted by total engagement desc) ----
    const commentLookup = Object.fromEntries(
      commentResults.map((cr) => [cr.mediaId, cr.comments])
    );

    const rankedPosts = mediaItems
      .map((media) => {
        const likeCount = media.like_count ?? 0;
        const commentCount = media.comments_count ?? 0;
        const totalEngagement = likeCount + commentCount;
        const commentData = commentLookup[media.id]?.data ?? [];

        return {
          mediaId: media.id,
          caption: media.caption || null,
          mediaType: media.media_type,
          permalink: media.permalink,
          timestamp: media.timestamp,
          likeCount,
          commentCount,
          totalEngagement,
          comments: commentData,
        };
      })
      .sort((a, b) => b.totalEngagement - a.totalEngagement);

    // ---- Build prospects list (sorted by interaction count desc) ----
    const prospectMap = buildProspectMap(rankedPosts, me?.username);

    const prospects = [...prospectMap.values()]
      .map((p) => ({
        ...p,
        totalInteractions: p.interactions.length,
        // Sort each prospect's interactions newest-first
        interactions: p.interactions.sort(
          (a, b) => new Date(b.commentedAt) - new Date(a.commentedAt)
        ),
      }))
      .sort((a, b) => b.totalInteractions - a.totalInteractions);

    // ---- Summary ----
    const totalLikes = rankedPosts.reduce((s, p) => s + p.likeCount, 0);
    const totalComments = rankedPosts.reduce((s, p) => s + p.commentCount, 0);

    res.json({
      me,
      summary: {
        totalPosts: rankedPosts.length,
        totalLikes,
        totalComments,
        totalEngagement: totalLikes + totalComments,
        uniqueProspects: prospects.length,
      },
      rankedPosts,
      prospects,
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

export default router;