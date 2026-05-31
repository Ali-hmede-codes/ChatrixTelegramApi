const fs = require("fs");
const path = require("path");
const config = require("../config");
const { getClient, resolveEntity } = require("../client/telegram");

const MEDIA_DIR = path.resolve(config.media.dir);

function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

function getCachePath(channel, messageId, ext) {
  return path.join(MEDIA_DIR, `${channel}_${messageId}${ext || ""}`);
}

function getExtension(msg) {
  if (!msg.media) return "";

  if (msg.media.photo) return ".jpg";

  if (msg.media.document) {
    const mime = msg.media.document.mimeType || "";
    const mimeMap = {
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/avi": ".avi",
      "video/mov": ".mov",
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "audio/mpeg": ".mp3",
      "audio/ogg": ".ogg",
      "application/pdf": ".pdf",
    };
    return mimeMap[mime] || "";
  }

  return "";
}

async function downloadMedia(identifier, messageId) {
  const client = await getClient();
  const entity = await resolveEntity(identifier);

  const messages = await client.getMessages(entity, { ids: [messageId] });
  const msg = messages[0];

  if (!msg || !msg.media) return null;

  const ext = getExtension(msg);
  const cachePath = getCachePath(identifier, messageId, ext);

  if (fs.existsSync(cachePath)) {
    return { path: cachePath, cached: true, media: msg.media };
  }

  ensureMediaDir();

  const buffer = await client.downloadMedia(msg, {});
  if (!buffer) return null;

  fs.writeFileSync(cachePath, buffer);
  return { path: cachePath, cached: false, media: msg.media, buffer };
}

async function streamMedia(identifier, messageId) {
  const client = await getClient();
  const entity = await resolveEntity(identifier);

  const messages = await client.getMessages(entity, { ids: [messageId] });
  const msg = messages[0];

  if (!msg || !msg.media) return null;

  const buffer = await client.downloadMedia(msg, {});
  if (!buffer) return null;

  return { buffer, media: msg.media };
}

function clearCache() {
  ensureMediaDir();
  const files = fs.readdirSync(MEDIA_DIR);
  let removed = 0;
  for (const file of files) {
    fs.unlinkSync(path.join(MEDIA_DIR, file));
    removed++;
  }
  return removed;
}

module.exports = { downloadMedia, streamMedia, clearCache, getCachePath, getExtension, MEDIA_DIR };