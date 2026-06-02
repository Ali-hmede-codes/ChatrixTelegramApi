const express = require("express");
const cors = require("cors");
const path = require("path");
const config = require("./config");
const { getClient } = require("./client/telegram");
const { startListening } = require("./realtime/listener");

const channelsRoute = require("./routes/channels");
const messagesRoute = require("./routes/messages");
const mediaRoute = require("./routes/media");
const realtimeRoute = require("./routes/realtime");
const healthRoute = require("./routes/health");
const feedRoute = require("./routes/feed");
const dashboardRoute = require("./routes/dashboard");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/health", healthRoute);
app.use("/channels", channelsRoute);
app.use("/messages", messagesRoute);
app.use("/media", mediaRoute);
app.use("/realtime", realtimeRoute);
app.use("/feed", feedRoute);
app.use("/dashboard", dashboardRoute);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: "Internal server error" });
});

async function initialize() {
  await getClient();
  console.log("Connected to Telegram");

  if (config.realtime.enabled) {
    await startListening();
  }
}

module.exports = { app, initialize };