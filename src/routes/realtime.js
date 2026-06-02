const express = require("express");
const { onMessage, offMessage, onDuplicate, offDuplicate } = require("../realtime/listener");

const router = express.Router();

const sseClients = new Set();

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now();
  sseClients.add(res);

  const messageHandler = (message) => {
    const allowed = req.query.channels;
    if (allowed) {
      const filter = allowed.split(",");
      const uid = String(message.channelUid || message.channelId);
      if (!filter.includes(uid)) return;
    }
    res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
  };

  const duplicateHandler = (message) => {
    const allowed = req.query.channels;
    if (allowed) {
      const filter = allowed.split(",");
      const uid = String(message.channelUid || message.channelId);
      if (!filter.includes(uid)) return;
    }
    res.write(`event: duplicate\ndata: ${JSON.stringify(message)}\n\n`);
  };

  onMessage(messageHandler);
  onDuplicate(duplicateHandler);

  req.on("close", () => {
    offMessage(messageHandler);
    offDuplicate(duplicateHandler);
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