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

// Ordinal words for news dedup: each word indicates a DIFFERENT event.
// If two messages have DIFFERENT ordinal words, they are NOT duplicates (different events).
// If they have the SAME ordinal word (or both have none), normal similarity comparison applies.
// Each word gets its own unique group number.
// IMPORTANT: These must use NORMALIZED forms (after taa→ta, yaa→ya, alef→alef)
const ORDINAL_WORD_MAP = {
  // أخرى / آخر (another)
  "\u0627\u062E\u0631\u064A": 1,  // اخري (original: أخرى - normalized ي from ى)
  "\u0627\u062E\u0631": 2,    // اخر (original: آخر)
  // ثانية / ثان (second)
  "\u062B\u0627\u0646\u064A\u062A": 3, // ثانيت (original: ثانية)
  "\u062B\u0627\u0646": 4,    // ثان (original: ثان)
  // جديدة / جديد (new)
  "\u062C\u062F\u064A\u062F\u062A": 5, // جديدت (original: جديدة)
  "\u062C\u062F\u064A\u062F": 6,    // جديد (original: جديد)
  // ثالثة / ثالث (third)
  "\u062B\u0627\u0644\u062B\u062A": 7, // ثالثت (original: ثالثة)
  "\u062B\u0627\u0644\u062B": 8,    // ثالث (original: ثالث)
  // رابعة / رابع (fourth)
  "\u0631\u0627\u0628\u0639\u062A": 9, // رابعت (original: رابعة)
  "\u0631\u0627\u0628\u0639": 10,   // رابع (original: رابع)
  // خامسة / خامس (fifth)
  "\u062E\u0627\u0645\u0633\u062A": 11, // خامست (original: خامسة)
  "\u062E\u0627\u0645\u0633": 12,   // خامس (original: خامس)
  // سادسة / سادس (sixth)
  "\u0633\u0627\u062F\u0633\u062A": 13, // سادست (original: سادسة)
  "\u0633\u0627\u062F\u0633": 14,   // سادس (original: سادس)
  // سابعة / سابع (seventh)
  "\u0633\u0627\u0628\u0639\u062A": 15, // سابعت (original: سابعة)
  "\u0633\u0627\u0628\u0639": 16,   // سابع (original: سابع)
  // ثامنة / ثامن (eighth)
  "\u062B\u0627\u0645\u0646\u062A": 17, // ثامنت (original: ثامنة)
  "\u062B\u0627\u0645\u0646": 18,   // ثامن (original: ثامن)
  // تاسعة / تاسع (ninth)
  "\u062A\u0627\u0633\u0639\u062A": 19, // تاسعت (original: تاسعة)
  "\u062A\u0627\u0633\u0639": 20,   // تاسع (original: تاسع)
  // عاشرة / عاشر (tenth)
  "\u0639\u0627\u0634\u0631\u062A": 21, // عاشرت (original: عاشرة)
  "\u0639\u0627\u0634\u0631": 22,   // عاشر (original: عاشر)
};

function getOrdinalGroup(words) {
  for (const word of words) {
    if (ORDINAL_WORD_MAP[word] !== undefined) {
      return ORDINAL_WORD_MAP[word];
    }
  }
  return 0; // no ordinal word found
}

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

module.exports = { detectArabic, removeTashkeel, normalizeArabic, getOrdinalGroup, getArabicWords };