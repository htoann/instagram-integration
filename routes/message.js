const express = require("express");
const axios = require("axios");
const { getRecipientId } = require("../utils/instagram");

const router = express.Router();

const {
  APP_ID,
  APP_SECRET,
  REDIRECT_URI_MESSAGE,
} = process.env;

const OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_content_publish",
  "pages_read_engagement",
  "pages_show_list",
  "business_management",
].join(",");

/**
 * Login endpoint for Instagram messaging
 */
router.get("/login", (req, res) => {
  const url =
    `https://www.facebook.com/v24.0/dialog/oauth` +
    `?client_id=${APP_ID}` +
    `&redirect_uri=${REDIRECT_URI_MESSAGE}` +
    `&response_type=code` +
    `&scope=${OAUTH_SCOPES}`;
  res.redirect(url);
});

/**
 * Callback endpoint after OAuth - sends message directly
 */
router.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    console.log("Exchanging code for user token");
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v24.0/oauth/access_token",
      {
        params: {
          client_id: APP_ID,
          client_secret: APP_SECRET,
          redirect_uri: REDIRECT_URI_MESSAGE,
          code,
        },
      }
    );

    const userToken = tokenRes.data.access_token;

    console.log("Getting page accounts");
    const pagesRes = await axios.get(
      "https://graph.facebook.com/v24.0/me/accounts",
      { params: { access_token: userToken } }
    );

    const page = pagesRes.data.data[0];
    const pageId = page.id;
    const pageToken = page.access_token;
    console.log(`PAGE_ID: ${pageId}`);

    console.log("Getting recipient ID");
    const recipientId = await getRecipientId(pageId, pageToken);
    console.log(`RECIPIENT_ID: ${recipientId}`);

    const messageText = "Hello! This is an automated message from Instagram integration.";
    console.log("Sending message directly...");

    const sendRes = await axios.post(
      `https://graph.facebook.com/v24.0/${pageId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: messageText },
      },
      {
        params: { access_token: pageToken },
      }
    );

    res.json({
      success: true,
      message: "Message sent successfully!",
      messageText,
      data: sendRes.data
    });
  } catch (error) {
    console.error(`Error in message callback: ${error.response?.data || error.message}`);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// POST /message/send
router.post("/send", async (req, res) => {
  const { pageId, pageToken, recipientId, text } = req.body;
  try {
    const sendRes = await axios.post(
      `https://graph.facebook.com/v24.0/${pageId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text },
      },
      {
        params: { access_token: pageToken },
      }
    );
    res.json({ success: true, data: sendRes.data });
  } catch (error) {
    console.error(`Error sending message: ${error.response?.data || error.message}`);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

module.exports = router;
