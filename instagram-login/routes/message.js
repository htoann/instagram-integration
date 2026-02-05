import dotenv from "dotenv";
import express from "express";
import { getConversations, sendInstagramMessage } from "../utils/instagram.js";
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
    const { userId, username, accessToken } = await completeOAuthFlow(code, REDIRECT_URI_MESSAGE);

    const conversations = await getConversations(userId, accessToken);

    console.log("conversations ", JSON.stringify(conversations, null, 2));

    if (!conversations || conversations.length === 0) {
      return res.json({
        success: false,
        message: "No conversations found. Please send a message to this Instagram account first."
      });
    }

    // Get the first conversation and extract the recipient's IGID
    const firstConversation = conversations[0];
    const participants = firstConversation.participants?.data || [];

    console.log("Business account username:", username);

    // Find the participant that is not the business account (by username)
    const recipient = participants.find(p => p.username !== username);

    if (!recipient) {
      return res.json({
        success: false,
        message: "Could not find recipient in conversation."
      });
    }

    console.log("Recipient:", recipient.username, "IGID:", recipient.id);

    const messageText = "Hello! This is an automated message from Instagram Login integration.";
    const sendResult = await sendInstagramMessage(userId, recipient.id, messageText, accessToken);

    res.json({
      success: true,
      userId,
      username,
      message: "Message sent successfully!",
      messageText,
      data: sendResult,
    });
  } catch (error) {
    console.error(`Error in message callback: ${error.response?.data || error.message}`);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

export default router;
