const express = require("express");
const fs = require("fs");
const { downloadMedia, streamMedia, clearCache } = require("../services/media");
const registry = require("../services/channelRegistry");

function resolveChannel(param) {
  const entry = registry.getByUid(param);
  if (entry) return entry.telegramId;
  return registry.resolveIdentifier(param);
}

const router = express.Router();

router.get("/:channel/:messageId", async (req, res) => {
  try {
    const identifier = resolveChannel(req.params.channel);
    const result = await downloadMedia(identifier, parseInt(req.params.messageId));
    if (!result) return res.status(404).json({ success: false, error: "No media found" });

    const media = result.media;
    if (media.photo) {
      res.setHeader("Content-Type", "image/jpeg");
    } else if (media.document) {
      const mime = media.document.mimeType || "application/octet-stream";
      res.setHeader("Content-Type", mime);
      if (mime.startsWith("video/") || mime.startsWith("image/")) {
        res.setHeader("Content-Disposition", `inline`);
      } else {
        res.setHeader("Content-Disposition", `attachment`);
      }
    }

    if (result.cached && result.path) {
      const stat = fs.statSync(result.path);
      res.setHeader("Content-Length", stat.size);
      fs.createReadStream(result.path).pipe(res);
    } else {
      res.setHeader("Content-Length", result.buffer.length);
      res.send(result.buffer);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:channel/:messageId/stream", async (req, res) => {
  try {
    const identifier = resolveChannel(req.params.channel);
    const result = await streamMedia(identifier, parseInt(req.params.messageId));
    if (!result) return res.status(404).json({ success: false, error: "No media found" });

    const mime = result.media.document?.mimeType || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", result.buffer.length);
    res.send(result.buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/cache", async (req, res) => {
  try {
    const removed = clearCache();
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;