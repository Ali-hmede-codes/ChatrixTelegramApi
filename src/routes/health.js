const express = require("express");
const { getClient, isConnected } = require("../client/telegram");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const connected = isConnected();
    res.json({
      success: true,
      connected,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;