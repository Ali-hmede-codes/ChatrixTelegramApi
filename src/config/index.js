require("dotenv").config();

module.exports = {
  telegram: {
    apiId: parseInt(process.env.API_ID || "0"),
    apiHash: process.env.API_HASH || "",
    session: process.env.SESSION || "",
    connectionRetries: parseInt(process.env.CONNECTION_RETRIES || "5"),
    requestRetries: parseInt(process.env.REQUEST_RETRIES || "5"),
    downloadRetries: parseInt(process.env.DOWNLOAD_RETRIES || "3"),
    useWSS: process.env.USE_WSS === "true",
    timeout: parseInt(process.env.TIMEOUT || "10"),
    floodSleepThreshold: parseInt(process.env.FLOOD_SLEEP_THRESHOLD || "60"),
  },
  server: {
    port: parseInt(process.env.PORT || "3000"),
    host: process.env.HOST || "0.0.0.0",
  },
  media: {
    dir: process.env.MEDIA_DIR || "media",
    maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE_MB || "500"),
  },
  messages: {
    defaultLimit: parseInt(process.env.DEFAULT_MESSAGE_LIMIT || "20"),
    maxLimit: parseInt(process.env.MAX_MESSAGE_LIMIT || "100"),
  },
  realtime: {
    enabled: process.env.REALTIME_ENABLED === "true",
    channels: (process.env.REALTIME_CHANNELS || "").split(",").filter(Boolean),
  },
  dedup: {
    enabled: process.env.DEDUP_ENABLED === "true",
    similarityThreshold: parseFloat(process.env.DEDUP_SIMILARITY_THRESHOLD || "0.6"),
    skipDuplicates: process.env.DEDUP_SKIP_DUPLICATES === "true",
  },
};