import dotenv from "dotenv";
import express from "express";

dotenv.config();

const router = express.Router();

const { VERIFY_TOKEN } = process.env;

router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

router.post("/", (req, res) => {
  const body = req.body;

  console.log("Incoming:");
  console.log(JSON.stringify(body, null, 2));

  if (body.object !== "instagram") {
    return res.sendStatus(404);
  }

  body.entry?.forEach((entry) => {
    entry.messaging?.forEach((event) => {
      const senderId = event.sender?.id;
      const text = event.message?.text;

      if (text) {
        console.log(`User: ${senderId}`);
        console.log(`Message: ${text}`);
      }
    });
  });

  res.sendStatus(200);
});

export default router;
