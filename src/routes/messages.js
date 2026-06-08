const express = require("express");
const config = require("../config");
const { getMessages, getMessage } = require("../services/messages");
const { filterDuplicates } = require("../services/newsDedup");
const registry = require("../services/channelRegistry");

function resolveChannel(param) {
  const entry = registry.getByUid(param);
  if (entry) return entry.telegramId;
  return registry.resolveIdentifier(param);
}

router = express.Router();

router.get("/:channel", async (req, res) => {
  try {
    const identifier = resolveChannel(req.params.channel);
    const limit = parseInt(req.query.limit) || config.messages.defaultLimit;
    const offset = parseInt(req.query.offset) || 0;
    const messages = await getMessages(identifier, limit, offset);
    const deduped = filterDuplicates(messages, {
      hideDuplicates: req.query.dedup === "filter",
    });
    res.json({ success: true, data: deduped });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:channel/:messageId", async (req, res) => {
  try {
    const identifier = resolveChannel(req.params.channel);
    const message = await getMessage(identifier, parseInt(req.params.messageId));
    if (!message) return res.status(404).json({ success: false, error: "Message not found" });
    res.json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;