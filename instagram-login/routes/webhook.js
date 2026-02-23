import dotenv from "dotenv";
import express from "express";
import { publishToAllUsers } from "../utils/realtime.js";

dotenv.config();

const router = express.Router();

const { VERIFY_TOKEN } = process.env;

const safe = {
  arr: (v) => Array.isArray(v) ? v : [],
  obj: (v) => v && typeof v === "object" && !Array.isArray(v) ? v : null,
  str: (v) => String(v || "").trim() || null,
};

const extractMessagingEvents = (entry) => {
  const direct = safe.arr(entry?.messaging)
    .filter((e) => e && typeof e === "object")
    .map((event) => ({ ownerUserId: safe.str(entry?.id), event }));

  const changes = safe.arr(entry?.changes)
    .filter((c) => c?.field === "messages")
    .flatMap((c) => {
      const value = safe.obj(c?.value);
      if (!value) return [];

      const events = [value, ...safe.arr(value.messaging), ...safe.arr(value.messages)
        .map((msg) => ({ message: msg, sender: value.sender, recipient: value.recipient }))];

      return events
        .filter((e) => e && typeof e === "object")
        .map((event) => ({
          ownerUserId: safe.str(event?.recipient?.id || value?.recipient?.id || value?.id || entry?.id),
          event,
        }));
    });

  return [...direct, ...changes];
};

router.get("/", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post("/", (req, res) => {
  const body = req.body;
  console.log("Incoming:", JSON.stringify(body, null, 2));

  if (body.object !== "instagram") return res.sendStatus(404);

  body.entry?.forEach((entry) => {
    extractMessagingEvents(entry).forEach(({ ownerUserId, event }) => {
      const senderId = safe.str(event?.sender?.id);
      const text = event?.message?.text || "";
      const hasPayload = event?.message || event?.message?.attachments?.length || event?.message?.mid;

      if (!hasPayload) return;

      console.log(`User: ${senderId || "unknown"}${text ? ` | Message: ${text}` : ""}`);
      publishToAllUsers({
        type: "message_incoming",
        ownerUserId,
        senderId,
        recipientId: safe.str(event?.recipient?.id),
        text,
        event,
        receivedAt: new Date().toISOString(),
      });
    });
  });

  res.sendStatus(200);
});

export default router;
