const { normalizeArabic, getArabicWords, getOrdinalGroup } = require("../utils/arabicDetection");
const config = require("../config");

// Global store shared by BOTH the real-time listener and the messages API.
// The API is protected from false-positives by the timestamp guard in
// checkDuplicate: an older original can never be flagged as a duplicate
// of a newer copy that the real-time listener stored first.
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

function cleanupExpired() {
  const now = Date.now();
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
  const ts = timestampMs != null ? timestampMs : Date.now();

  let alreadyInStore = false;

  for (const stored of messageStore) {
    // Self-match: this message is already in the store (e.g. real-time
    // stored it, then the API processes the same message).
    if (stored.messageId === message.id) {
      alreadyInStore = true;
      continue;
    }

    // Timestamp guard: never flag an older message as a duplicate of a
    // newer one.  When the real-time listener stores a newer duplicate B'
    // before the API processes the older original B, this prevents B from
    // being incorrectly flagged as a duplicate of B'.
    if (stored.timestamp > ts) continue;

    if (ordinalGroup !== stored.ordinalGroup) {
      continue;
    }

    const similarity = jaccardSimilarity(signature, stored.signature);

    // For short messages (few words), require higher similarity to avoid
    // false positives where only the location/entity name differs.
    // e.g. "قصف مدفعي طال قبريخا" vs "قصف مدفعي طال النبطية"
    //      3 shared / 5 unique = 0.6, but these are different events.
    const minWordsForRelaxedThreshold = 6;
    const effectiveThreshold =
      signature.size < minWordsForRelaxedThreshold &&
      stored.signature.size < minWordsForRelaxedThreshold
        ? 0.9
        : threshold;

    if (similarity >= effectiveThreshold) {
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

  // Only add to store if not already present (avoid duplicate entries)
  if (!alreadyInStore) {
    messageStore.push({
      messageId: message.id,
      channelId: message.channelId || null,
      text: normalizeArabic(text),
      signature,
      ordinalGroup,
      timestamp: ts,
    });
  }

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

// Filter duplicates from a batch of messages (for the messages API).
// Uses the GLOBAL messageStore so dedup works across real-time and API calls.
// Protected from false-positives by:
//   1. Self-match skip — same message ID is never a duplicate
//   2. Timestamp guard — older originals are never flagged as duplicates of newer copies
// Processes messages in chronological order (oldest first) so the first occurrence is kept.
// Duplicates are removed by default. Set `showDuplicates: true` to annotate instead of remove.
function filterDuplicates(messages, { showDuplicates = false } = {}) {
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
  messageStore.length = 0;
}

module.exports = { checkDuplicate, getStoreStats, cleanupExpired, filterDuplicates, _resetStore };