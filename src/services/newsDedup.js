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
  while (messageStore.length > 0 && now - messageStore[0].timestamp > HOUR_MS) {
    messageStore.shift();
  }
}

function checkDuplicate(message) {
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

  for (const stored of messageStore) {
    // Hard filter: different ordinal groups = different events = NOT duplicate
    // Example: "غارة على بيروت" (group 0) vs "غارة أخرى على بيروت" (group 1) = different
    // Example: "غارة أخرى على بيروت" (group 1) vs "غارة ثالثة على بيروت" (group 2) = different
    // Example: "غارة أخرى على بيروت" (group 1) vs "غارة ثانية على بيروت" (group 1) = same group, compare normally
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
        timestamp: Date.now(),
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
    timestamp: Date.now(),
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

module.exports = { checkDuplicate, getStoreStats, cleanupExpired };