import dotenv from "dotenv";
import express from "express";
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Feed posting: http://localhost:${PORT}/feed/login`);
  console.log(`Send message: http://localhost:${PORT}/message/login`);
  console.log(`Post story: http://localhost:${PORT}/story/login`);
  console.log(`Insight and comment: http://localhost:${PORT}/insight/login`);
});
