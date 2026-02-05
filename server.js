require("dotenv").config();
const express = require("express");

const webhookRoutes = require("./routes/webhook");
const feedRoutes = require("./routes/feed");
const messageRoutes = require("./routes/message");

const app = express();
app.use(express.json());

const { PORT } = process.env;

app.get("/", (req, res) => {
  res.send("Instagram Integration Server");
});

app.use("/webhook", webhookRoutes);
app.use("/feed", feedRoutes);
app.use("/message", messageRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Feed posting: http://localhost:${PORT}/feed/login`);
  console.log(`Send message: http://localhost:${PORT}/message/login`);
});
