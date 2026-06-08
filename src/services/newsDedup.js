const { normalizeArabic, getArabicWords, getOrdinalGroup } = require("../utils/arabicDetection");
const config = require("../config");

const messageStore = [];
const HOUR_MS = 60 * 60 * 1000;

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function buildTextSignature(text) {
  const words = getArabicWords(text);
  return new Set(words);
}

function cleanupExpired() {
  const now = Date.now();
  // Filter all expired entries (store may be unsorted when mixing real-time & historical timestamps)
  for (let i = messageStore.length - 1; i >= 0; i--) {
    if (now - messageStore[i].timestamp > HOUR_MS) {
      messageStore.splice(i, 1);
    }
  }
}

function checkDuplicate(message, timestampMs) {
  cleanupExpired();

  const text = message.text || "";
  if (!text || text.trim().length < 3) {
    return { isDuplicate: false, duplicateOf: null, similarity: 0 };
  }

  const words = getArabicWords(text);
  const signature = new Set(words);
  if (signature.size < 1) {
    return { isDuplicate: false, duplicateOf: null, similarity: 0 };
  }
  const ordinalGroup = getOrdinalGroup(words);
  const threshold = config.dedup?.similarityThreshold || 0.6;
  const ts = timestampMs || Date.now();

  for (const stored of messageStore) {
    // Skip self-matches: same message ID means it's the same message,
    // not a duplicate (e.g. real-time already stored it, then API fetches it).
    if (stored.messageId === message.id) continue;

    if (ordinalGroup !== stored.ordinalGroup) {
      continue;
    }

    const similarity = jaccardSimilarity(signature, stored.signature);
    if (similarity >= threshold) {
      // Also store the duplicate so it extends the dedup window
      messageStore.push({
        messageId: message.id,
        channelId: message.channelId || null,
        text: normalizeArabic(text),
        signature,
        ordinalGroup,
        timestamp: ts,
      });

      return {
        isDuplicate: true,
        duplicateOf: stored.messageId,
        duplicateChannel: stored.channelId,
        similarity: Math.round(similarity * 100),
      };
    }
  }

  messageStore.push({
    messageId: message.id,
    channelId: message.channelId || null,
    text: normalizeArabic(text),
    signature,
    ordinalGroup,
    timestamp: ts,
  });

  return { isDuplicate: false, duplicateOf: null, similarity: 0 };
}

function getStoreStats() {
  cleanupExpired();
  return {
    storedMessages: messageStore.length,
    timeWindowMs: HOUR_MS,
    similarityThreshold: config.dedup?.similarityThreshold || 0.6,
  };
}

// Annotate duplicates in a batch of messages (for the messages API).
// Uses the GLOBAL messageStore so results are cached across API calls and real-time.
// Uses each message's actual `date` field (Unix timestamp) as the store timestamp.
// Processes messages in chronological order (oldest first) so the first occurrence is kept.
// Duplicates are NOT removed by default \u2014 they are annotated with isDuplicate, duplicateOf, similarity.
// If `hideDuplicates` is true, duplicate messages are excluded from the result.
function filterDuplicates(messages, { hideDuplicates = false } = {}) {
  if (!config.dedup?.enabled) return messages;

  // Sort by date ascending (oldest first) so first occurrence is kept as non-duplicate
  const sorted = [...messages].sort((a, b) => (a.date || 0) - (b.date || 0));
  const results = [];

  for (const msg of sorted) {
    const msgTimestamp = (msg.date || 0) * 1000; // Unix seconds -> ms
    const result = checkDuplicate(msg, msgTimestamp);

    if (result.isDuplicate) {
      msg.isDuplicate = true;
      msg.duplicateOf = result.duplicateOf;
      msg.duplicateChannel = result.duplicateChannel;
      msg.similarity = result.similarity;
    } else {
      msg.isDuplicate = false;
    }

    if (hideDuplicates && result.isDuplicate) {
      continue;
    }

    results.push(msg);
  }

  return results;
}

// Reset store (for testing only)
function _resetStore() {
  messageStore.length = 0;
}

module.exports = { checkDuplicate, getStoreStats, cleanupExpired, filterDuplicates, _resetStore };