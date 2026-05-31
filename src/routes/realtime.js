const express = require("express");
const { onMessage, offMessage } = require("../realtime/listener");

const router = express.Router();

const sseClients = new Set();

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now();
  sseClients.add(res);

  const handler = (message) => {
    const allowed = req.query.channels;
    if (allowed) {
      const filter = allowed.split(",");
      if (!filter.includes(message.channelId)) return;
    }
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  };

  onMessage(handler);

  req.on("close", () => {
    offMessage(handler);
    sseClients.delete(res);
  });
});

router.get("/status", (req, res) => {
  res.json({
    success: true,
    connectedClients: sseClients.size,
    realtimeEnabled: require("../config").realtime.enabled,
  });
});

module.exports = router;