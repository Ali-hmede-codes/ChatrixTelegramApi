const { franc } = require("franc");

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const ARABIC_REGEX_NOG = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const TASHKEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]/g;

const ALEF_NORMALIZE_MAP = {
  "\u0622": "\u0627",
  "\u0623": "\u0627",
  "\u0625": "\u0627",
  "\u0671": "\u0627",
};

const YAA_NORMALIZE = { "\u0649": "\u064A" };
const TAA_NORMALIZE = { "\u0629": "\u062A" };

function detectArabic(text) {
  if (!text || text.trim().length === 0) {
    return { isArabic: false, confidence: 0, method: "empty" };
  }

  const arabicCharCount = (text.match(ARABIC_REGEX) || []).length;
  const totalAlphaCount = text.replace(/[\s\d\p{P}]/gu, "").length;
  const ratio = totalAlphaCount > 0 ? arabicCharCount / totalAlphaCount : 0;

  if (ratio >= 0.3) {
    return { isArabic: true, confidence: Math.min(ratio, 1), method: "regex" };
  }

  if (text.length >= 10) {
    const langCode = franc(text);
    if (langCode === "ara") {
      return { isArabic: true, confidence: 0.85, method: "franc" };
    }
  }

  return { isArabic: false, confidence: ratio, method: ratio > 0 ? "regex" : "none" };
}

function removeTashkeel(text) {
  return text.replace(TASHKEEL_REGEX, "");
}

function normalizeArabic(text) {
  let normalized = removeTashkeel(text);
  for (const [from, to] of Object.entries(ALEF_NORMALIZE_MAP)) {
    normalized = normalized.replace(new RegExp(from, "g"), to);
  }
  for (const [from, to] of Object.entries(YAA_NORMALIZE)) {
    normalized = normalized.replace(new RegExp(from, "g"), to);
  }
  for (const [from, to] of Object.entries(TAA_NORMALIZE)) {
    normalized = normalized.replace(new RegExp(from, "g"), to);
  }
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

function getArabicWords(text) {
  const normalized = normalizeArabic(text);
  return normalized
    .split(/\s+/)
    .filter((w) => w.length > 1 && ARABIC_REGEX_NOG.test(w));
}

module.exports = { detectArabic, removeTashkeel, normalizeArabic, getArabicWords };