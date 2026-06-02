const natural = require("natural");
const { TfIdf } = natural;
const { processText } = require("./textProcessor");

const CORRECTION_KEYWORDS = ["تصحيح", "تعديل", "correction", "update", "تحديث"];

function isCorrection(text) {
  const lower = text.toLowerCase().trim();
  return CORRECTION_KEYWORDS.some((kw) => lower.startsWith(kw));
}

class DedupEngine {
  constructor(windowHours = 1, similarityThreshold = 0.75) {
    this.windowHours = windowHours;
    this.similarityThreshold = similarityThreshold;
    this.messageStore = new Map();
  }

  checkDuplicate(rawText, messageId, channelUid, date) {
    const processedText = processText(rawText || "");

    if (processedText.length < 10) {
      return { isDuplicate: false, processedText };
    }

    if (isCorrection(rawText || "")) {
      this.register(processedText, messageId, channelUid, date, rawText);
      return { isDuplicate: false, processedText };
    }

    const exactMatch = this.messageStore.get(processedText);
    if (exactMatch && Math.abs(date - exactMatch.date) <= this.windowHours * 3600) {
      return {
        isDuplicate: true,
        duplicateOf: exactMatch.messageId,
        originalChannel: exactMatch.channelUid,
        similarity: 1.0,
        processedText,
      };
    }

    const windowSeconds = this.windowHours * 3600;
    for (const [key, stored] of this.messageStore.entries()) {
      if (Math.abs(date - stored.date) > windowSeconds) continue;

      const similarity = computeCosineSimilarity(processedText, key);
      if (similarity >= this.similarityThreshold) {
        return {
          isDuplicate: true,
          duplicateOf: stored.messageId,
          originalChannel: stored.channelUid,
          similarity,
          processedText,
        };
      }
    }

    this.register(processedText, messageId, channelUid, date, rawText);
    return { isDuplicate: false, processedText };
  }

  register(processedText, messageId, channelUid, date, originalText) {
    this.messageStore.set(processedText, {
      messageId,
      channelUid,
      date,
      originalText,
    });
  }

  cleanup(now) {
    const cutoff = now - this.windowHours * 3600 * 2;
    for (const [key, stored] of this.messageStore.entries()) {
      if (stored.date < cutoff) this.messageStore.delete(key);
    }
  }
}

function computeCosineSimilarity(textA, textB) {
  const tfidf = new TfIdf();
  tfidf.addDocument(textA);
  tfidf.addDocument(textB);

  const termsA = {};
  const termsB = {};

  tfidf.listTerms(0).forEach((item) => {
    termsA[item.term] = item.tfidf;
  });
  tfidf.listTerms(1).forEach((item) => {
    termsB[item.term] = item.tfidf;
  });

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const term in termsA) {
    if (termsB[term]) dotProduct += termsA[term] * termsB[term];
    normA += termsA[term] ** 2;
  }

  for (const term in termsB) {
    normB += termsB[term] ** 2;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

let engine = null;

function getEngine() {
  if (!engine) {
    const config = require("../config");
    engine = new DedupEngine(config.dedup.windowHours, config.dedup.similarityThreshold);
  }
  return engine;
}

module.exports = { DedupEngine, getEngine, computeCosineSimilarity };