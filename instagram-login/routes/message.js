import dotenv from "dotenv";
import express from "express";
import {
  getConversationMessages,
  getConversations,
  sendInstagramMessage,
} from "../utils/instagram.js";
import { getOAuthLoginUrl } from "../utils/oauth.js";
import { addStreamClient, publishToUser, removeStreamClient } from "../utils/realtime.js";
import {
  getInstagramMe,
  handleApiError
} from "../utils/routeHelpers.js";

dotenv.config();

const router = express.Router();

const { REDIRECT_URI_MESSAGE } = process.env;

router.get("/login", (req, res) => {
  const url = getOAuthLoginUrl(REDIRECT_URI_MESSAGE);
  res.redirect(url);
});

router.get("/conversations", async (req, res) => {
  const accessToken = req.accessToken;

  try {
    const me = await getInstagramMe(accessToken);
    const conversations = await getConversations(me.id, accessToken);
    res.json({
      success: true,
      userId: me.id,
      username: me.username,
      conversations,
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.get("/stream", async (req, res) => {
  const accessToken = String(req.query.accessToken || "").trim();

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      error: "accessToken query param is required",
    });
  }

  try {
    const me = await getInstagramMe(accessToken);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    addStreamClient(me.id, res);
    res.write(`data: ${JSON.stringify({ type: "connected", userId: me.id })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      removeStreamClient(me.id, res);
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.get("/messages/:conversationId", async (req, res) => {
  const accessToken = req.accessToken;
  const { conversationId } = req.params;
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 25;

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      error: "conversationId is required",
    });
  }

  try {
    const messages = await getConversationMessages(conversationId, accessToken, limit);
    res.json({
      success: true,
      conversationId,
      messages,
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.post("/send", async (req, res) => {
  const accessToken = req.accessToken;
  const { recipientId, message, conversationId } = req.body || {};

  if (!message) {
    return res.status(400).json({
      success: false,
      error: "message is required",
    });
  }

  try {
    const me = await getInstagramMe(accessToken);
    const candidateRecipientIds = [];

    if (recipientId) {
      candidateRecipientIds.push(String(recipientId));
    }

    if (conversationId) {
      const recentMessages = await getConversationMessages(conversationId, accessToken, 50);

      for (const item of recentMessages) {
        const fromId = item?.from?.id ? String(item.from.id) : "";
        if (fromId && fromId !== me.id) candidateRecipientIds.push(fromId);

        const toIds = item?.to?.data || [];
        for (const target of toIds) {
          const toId = target?.id ? String(target.id) : "";
          if (toId && toId !== me.id) candidateRecipientIds.push(toId);
        }
      }

      const conversations = await getConversations(me.id, accessToken);
      const selectedConversation = (conversations || []).find(
        (conversation) => String(conversation?.id) === String(conversationId)
      );
      const participants = selectedConversation?.participants?.data || [];
      for (const participant of participants) {
        const participantId = participant?.id ? String(participant.id) : "";
        if (participantId && participantId !== me.id) {
          candidateRecipientIds.push(participantId);
        }
      }
    }

    const resolvedCandidates = [...new Set(candidateRecipientIds.filter(Boolean))];

    if (!resolvedCandidates.length) {
      return res.status(400).json({
        success: false,
        error: "recipientId is required (or provide conversationId to auto-resolve recipient).",
      });
    }

    let sentResult = null;
    let usedRecipientId = null;
    let lastInvalidRecipientError = null;

    for (const candidateRecipientId of resolvedCandidates) {
      if (candidateRecipientId === me.id) continue;

      try {
        const data = await sendInstagramMessage(me.id, candidateRecipientId, message, accessToken);
        sentResult = data;
        usedRecipientId = candidateRecipientId;
        break;
      } catch (error) {
        const apiError = error.response?.data?.error;
        const isInvalidRecipient = apiError?.code === 100 && apiError?.error_subcode === 2534014;

        if (isInvalidRecipient) {
          lastInvalidRecipientError = error;
          continue;
        }

        throw error;
      }
    }

    if (!sentResult) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RECIPIENT",
        error:
          "No valid recipient ID found for Instagram Messaging API in this conversation. Ensure recipient is Instagram-scoped user ID (IGSID) from webhook/message event, app has instagram_manage_messages permission, and recipient has permission to interact with the app in current app mode.",
        attemptedRecipientIds: resolvedCandidates,
        senderUserId: me.id,
        details: lastInvalidRecipientError?.response?.data,
      });
    }

    publishToUser(me.id, {
      type: "message_outgoing",
      userId: me.id,
      recipientId: usedRecipientId,
      message,
      createdTime: new Date().toISOString(),
    });

    res.json({
      success: true,
      recipientIdUsed: usedRecipientId,
      attemptedRecipientIds: resolvedCandidates,
      data: sentResult,
    });
  } catch (error) {
    const apiError = error.response?.data?.error;

    if (apiError?.code === 100 && apiError?.error_subcode === 2534014) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RECIPIENT",
        error:
          "Recipient ID is not valid for Instagram Messaging API. Use the other participant id from the conversation/messages or send conversationId so server can auto-resolve.",
        details: error.response?.data,
      });
    }

    handleApiError(res, error);
  }
});

export default router;
