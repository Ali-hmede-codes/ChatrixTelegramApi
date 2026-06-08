const { normalizeArabic, getArabicWords, getOrdinalGroup } = require("../utils/arabicDetection");
const config = require("../config");

// Global store used ONLY by the real-time listener.
// The messages API (filterDuplicates) uses its own local store per call
// to avoid cross-contamination between real-time and API results.
const globalStore = [];
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

function cleanupExpired(store) {
  const now = Date.now();
  for (let i = store.length - 1; i >= 0; i--) {
    if (now - store[i].timestamp > HOUR_MS) {
      store.splice(i, 1);
    }
  }
}

function checkDuplicate(message, timestampMs, store) {
  store = store || globalStore;
  cleanupExpired(store);

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

  for (const stored of store) {
    if (ordinalGroup !== stored.ordinalGroup) {
      continue;
    }

    const similarity = jaccardSimilarity(signature, stored.signature);

    // For short messages (few words), require higher similarity to avoid
    // false positives where only the location/entity name differs.
    // e.g. "قصف مدفعي طال قبريخا" vs "قصف مدفعي طال النبطية"
    //      3 shared / 5 unique = 0.6, but these are different events.
    //      Only exact or near-exact word matches should dedup short messages.
    const minWordsForRelaxedThreshold = 6;
    const effectiveThreshold =
      signature.size < minWordsForRelaxedThreshold &&
      stored.signature.size < minWordsForRelaxedThreshold
        ? 0.9
        : threshold;

    if (similarity >= effectiveThreshold) {
      // Also store the duplicate so it extends the dedup window
      store.push({
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

  store.push({
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
  cleanupExpired(globalStore);
  return {
    storedMessages: globalStore.length,
    timeWindowMs: HOUR_MS,
    similarityThreshold: config.dedup?.similarityThreshold || 0.6,
  };
}

// Filter duplicates from a batch of messages (for the messages API).
// Uses a LOCAL store per call — completely isolated from the real-time listener's
// global store. This prevents a newer duplicate (seen by real-time) from causing
// the older original to disappear from the API.
// Processes messages in chronological order (oldest first) so the first occurrence is kept.
// Duplicates are removed by default. Set `showDuplicates: true` to annotate instead of remove.
function filterDuplicates(messages, { showDuplicates = false } = {}) {
  if (!config.dedup?.enabled) return messages;

  // Local store — only this batch's messages are compared against each other
  const localStore = [];

  // Sort by date ascending (oldest first) so first occurrence is kept as non-duplicate
  const sorted = [...messages].sort((a, b) => (a.date || 0) - (b.date || 0));
  const results = [];

  for (const msg of sorted) {
    const msgTimestamp = (msg.date || 0) * 1000; // Unix seconds -> ms
    const result = checkDuplicate(msg, msgTimestamp, localStore);

    if (result.isDuplicate) {
      msg.isDuplicate = true;
      msg.duplicateOf = result.duplicateOf;
      msg.duplicateChannel = result.duplicateChannel;
      msg.similarity = result.similarity;
    } else {
      msg.isDuplicate = false;
    }

    if (!showDuplicates && result.isDuplicate) {
      continue;
    }

    results.push(msg);
  }

  // Return newest messages first
  return results.sort((a, b) => (b.date || 0) - (a.date || 0));
}

// Reset store (for testing only)
function _resetStore() {
  globalStore.length = 0;
}

module.exports = { checkDuplicate, getStoreStats, cleanupExpired, filterDuplicates, _resetStore };