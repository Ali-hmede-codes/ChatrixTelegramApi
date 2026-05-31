const express = require("express");
const { listChannels, getChannelByUid } = require("../services/channels");
const registry = require("../services/channelRegistry");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const channels = await listChannels();
    res.json({ success: true, data: channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/registry", (req, res) => {
  res.json({ success: true, data: registry.getAll() });
});

router.get("/:uid", async (req, res) => {
  try {
    const channel = await getChannelByUid(req.params.uid);
    if (!channel) return res.status(404).json({ success: false, error: "Channel not found" });
    res.json({ success: true, data: channel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/:uid", (req, res) => {
  const removed = registry.removeByUid(req.params.uid);
  if (!removed) return res.status(404).json({ success: false, error: "Channel not found in registry" });
  res.json({ success: true, data: { uid: parseInt(req.params.uid) } });
});

module.exports = router;