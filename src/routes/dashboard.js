const express = require("express");
const path = require("path");

const router = express.Router();

const publicDir = path.join(__dirname, "..", "public");

router.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "dashboard.html"));
});

module.exports = router;