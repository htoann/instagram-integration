import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import { getRecipientId } from "../utils/instagram.js";
import { completeOAuthFlow, getOAuthLoginUrl } from "../utils/oauth.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_MESSAGE } = process.env;

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_MESSAGE);
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { pageId, pageToken } = await completeOAuthFlow(code, REDIRECT_URI_MESSAGE);

    const recipientId = await getRecipientId(pageId, pageToken);

    const messageText = "Hello! This is an automated message from Instagram integration.";
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
      data: sendRes.data,
    });
  } catch (error) {
    console.error(`Error in message callback: ${error.response?.data || error.message}`);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

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

export default router;
