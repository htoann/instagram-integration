import dotenv from "dotenv";
import express from "express";
import { getInstagramAccountInsights } from "../utils/instagram.js";
import { getOAuthLoginUrl } from "../utils/oauth.js";
import {
  getInstagramMe,
  handleApiError
} from "../utils/routeHelpers.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_INSIGHT } = process.env;
const DEFAULT_ACCOUNT_METRICS = ["impressions", "reach", "profile_views", "follower_count"];
const ALLOWED_PERIODS = new Set(["day", "week", "days_28", "lifetime"]);

const parseMetrics = (metricsQuery) => {
  if (!metricsQuery) return DEFAULT_ACCOUNT_METRICS;

  const metrics = String(metricsQuery)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return metrics.length ? metrics : DEFAULT_ACCOUNT_METRICS;
};

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_INSIGHT);
  res.redirect(url);
});

router.get("/insights", async (req, res) => {
  const accessToken = req.accessToken;
  const metrics = parseMetrics(req.query.metrics);
  const period = ALLOWED_PERIODS.has(String(req.query.period || "").trim())
    ? String(req.query.period).trim()
    : "day";
  const since = req.query.since ? String(req.query.since).trim() : undefined;
  const until = req.query.until ? String(req.query.until).trim() : undefined;

  try {
    const { id: userId, username } = await getInstagramMe(accessToken);

    const insights = await getInstagramAccountInsights(userId, accessToken, {
      metrics,
      period,
      since,
      until,
    });

    res.json({
      success: true,
      userId,
      username,
      query: {
        metrics,
        period,
        since: since || null,
        until: until || null,
      },
      insights,
      message: "Successfully retrieved Instagram account insights.",
    });
  } catch (error) {
    console.error(`Error getting insights via /insight/insights: ${error.response?.data || error.message}`);
    handleApiError(res, error);
  }
});

export default router;