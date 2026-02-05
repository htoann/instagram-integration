import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import https from "https";
import feedRoutes from "./routes/feed.js";
import insightRoutes from "./routes/insight.js";
import messageRoutes from "./routes/message.js";
import storyRoutes from "./routes/story.js";
import webhookRoutes from "./routes/webhook.js";

dotenv.config();

const app = express();
app.use(express.json());

const { PORT } = process.env;

app.get("/", (req, res) => {
  res.send("Instagram Integration Server");
});

app.use("/webhook", webhookRoutes);
app.use("/feed", feedRoutes);
app.use("/message", messageRoutes);
app.use("/story", storyRoutes);
app.use("/insight", insightRoutes);

const httpsOptions = {
  key: fs.readFileSync('./server.key'),
  cert: fs.readFileSync('./server.cert')
};

https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`Server running on https://localhost:${PORT}`);
  console.log(`Webhook on https://localhost:${PORT}/webhook`);
  console.log(`Feed posting: https://localhost:${PORT}/feed/login`);
  console.log(`Send message: https://localhost:${PORT}/message/login`);
  console.log(`Post story: https://localhost:${PORT}/story/login`);
  console.log(`Insight and comment: https://localhost:${PORT}/insight/login`);
});
