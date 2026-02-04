require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const {
  PORT = 3000,
  APP_ID,
  APP_SECRET,
  REDIRECT_URI,
  VERIFY_TOKEN,
} = process.env;

const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management",
].join(",");

/**
 * Retrieves the recipient ID (PSID) for Instagram messaging.
 * @param {string} pageId - The Facebook page ID.
 * @param {string} pageToken - The page access token.
 * @returns {Promise<string>} The user ID.
 */
async function getRecipientId(pageId, pageToken) {
  try {
    console.log(`Getting conversations from ${pageId}/conversations?platform=instagram`);
    const convRes = await axios.get(
      `https://graph.facebook.com/v24.0/${pageId}/conversations`,
      {
        params: {
          platform: "instagram",
          access_token: pageToken,
        },
      }
    );

    if (!convRes.data.data || convRes.data.data.length === 0) {
      throw new Error("No Instagram conversations found.");
    }

    const threadId = convRes.data.data[0].id;
    console.log(`Thread ID: ${threadId}`);

    console.log(`Getting participants from ${threadId}?fields=participants`);
    const partRes = await axios.get(
      `https://graph.facebook.com/v24.0/${threadId}`,
      {
        params: {
          fields: "participants",
          access_token: pageToken,
        },
      }
    );

    const participants = partRes.data.participants.data;
    console.log(`Participants: ${JSON.stringify(participants)}`);
    const userParticipant = participants[1]; // Assuming second participant is the user

    if (!userParticipant) {
      throw new Error("No user participant found.");
    }

    const userId = userParticipant.id;
    console.log(`User ID: ${userId}`);
    return userId;
  } catch (error) {
    console.error(`Error in getRecipientId: ${error.message}`);
    throw error;
  }
}

// Handles the OAuth callback and sends an Instagram message.
async function handleCallback(req, res) {
  const { code } = req.query;

  try {
    console.log("Exchanging code for user token");
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v24.0/oauth/access_token",
      {
        params: {
          client_id: APP_ID,
          client_secret: APP_SECRET,
          redirect_uri: REDIRECT_URI,
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

    // Send a message to the user via Instagram
    console.log(`Sending message to ${pageId}/messages with recipient ${recipientId}`);
    const sendRes = await axios.post(
      `https://graph.facebook.com/v24.0/${pageId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: "Hello from Graph API 👋" },
      },
      {
        params: { access_token: pageToken },
      }
    );
    console.log("Message sent successfully:", sendRes.data);
    res.send("Message sent successfully");
  } catch (error) {
    console.error(`Error in callback: ${error.response?.data || error.message}`);
    res.status(500).send(error.response?.data || error.message);
  }
}

// --------------------------------
// Step 1: login
// --------------------------------
app.get("/login", (req, res) => {
  const url =
    `https://www.facebook.com/v24.0/dialog/oauth` +
    `?client_id=${APP_ID}` +
    `&redirect_uri=${REDIRECT_URI}` +
    `&response_type=code` +
    `&scope=${OAUTH_SCOPES}`;
  res.redirect(url);
});

app.get("/", async (req, res) => {
  res.send("Ok");
});

// --------------------------------
// Webhook to receive messages from users
// --------------------------------
app.get("/webhook", (req, res) => {
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

app.post("/webhook", (req, res) => {
  const body = req.body;

  console.log("📩 Incoming:");
  console.log(JSON.stringify(body, null, 2));

  if (body.object !== "instagram") {
    return res.sendStatus(404);
  }

  body.entry?.forEach((entry) => {
    entry.messaging?.forEach((event) => {
      const senderId = event.sender?.id;
      const text = event.message?.text;

      if (text) {
        console.log(`👤 User: ${senderId}`);
        console.log(`💬 Message: ${text}`);
      }
    });
  });

  res.sendStatus(200);
});

// --------------------------------
// Step 2: callback → send message
// --------------------------------
app.get("/callback", handleCallback);

// --------------------------------
app.listen(PORT, () => {
  console.log(`👉 Open http://localhost:${PORT}/login`);
});
