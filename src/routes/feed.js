const express = require("express");
const { getFeed } = require("../services/feedService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await getFeed({
      limit: req.query.limit,
      hours: req.query.hours,
      channel: req.query.channel,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;