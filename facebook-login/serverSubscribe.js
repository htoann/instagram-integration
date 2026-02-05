import axios from "axios";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
app.use(express.json());

const {
  PORT = 3000,
  APP_ID,
  APP_SECRET,
  REDIRECT_URI,
  VERIFY_TOKEN
} = process.env;

const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management"
].join(",");

const subscribePage = async (pageId, pageToken) => {
  const res = await axios.post(
    `https://graph.facebook.com/v24.0/${pageId}/subscribed_apps`,
    null,
    {
      params: {
        subscribed_fields:
          "messages,messaging_postbacks,messaging_optins,message_deliveries",
        access_token: pageToken
      }
    }
  );

  console.log("✅ Subscribed:", res.data);
};

app.get("/", (_, res) => {
  res.send("Server running");
});

app.get("/login", (_, res) => {
  const url =
    `https://www.facebook.com/v24.0/dialog/oauth` +
    `?client_id=${APP_ID}` +
    `&redirect_uri=${REDIRECT_URI}` +
    `&response_type=code` +
    `&scope=${OAUTH_SCOPES}`;

  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  try {
    const { code } = req.query;

    const tokenRes = await axios.get(
      "https://graph.facebook.com/v24.0/oauth/access_token",
      {
        params: {
          client_id: APP_ID,
          client_secret: APP_SECRET,
          redirect_uri: REDIRECT_URI,
          code
        }
      }
    );

    const userToken = tokenRes.data.access_token;

    const pagesRes = await axios.get(
      "https://graph.facebook.com/v24.0/me/accounts",
      { params: { access_token: userToken } }
    );

    const page = pagesRes.data.data[0];

    await subscribePage(page.id, page.access_token);

    res.send("✅ Login success. Page subscribed. Now send IG message.");
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Error");
  }
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object !== "instagram") {
    return res.sendStatus(404);
  }

  body.entry.forEach(entry => {
    entry.changes.forEach(change => {
      if (change.field !== "messages") return;

      const msg = change.value.messages?.[0];
      if (!msg) return;

      const senderId = msg.from;
      const text = msg.text?.body || msg.text;

      console.log("👤", senderId);
      console.log("💬", text);
    });
  });

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`👉 http://localhost:${PORT}/login`);
});
