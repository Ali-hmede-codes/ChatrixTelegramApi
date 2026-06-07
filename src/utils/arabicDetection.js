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

// News dedup noise words: ordinal/qualifier words that should be REMOVED before
// comparing news, so that "غارة على بيروت" and "غارة أخرى على بيروت" match.
// IMPORTANT: These must use NORMALIZED forms (after taa→ta, yaa→ya, alef→alef normalizations)
// because normalizeArabic() runs before this filter in getArabicWords()
const NEWS_NOISE_WORDS = new Set([
  // another / other
  "\u0627\u062E\u0631\u064A",   // اخري (original: أخرى)
  "\u0627\u062E\u0631",       // اخر (original: آخر)
  // second
  "\u062B\u0627\u0646\u064A\u062A", // ثانيت (original: ثانية)
  "\u062B\u0627\u0646",       // ثان (original: ثان)
  // third
  "\u062B\u0627\u0644\u062B\u062A", // ثالثت (original: ثالثة)
  "\u062B\u0627\u0644\u062B",   // ثالث (original: ثالث)
  // fourth
  "\u0631\u0627\u0628\u0639\u062A", // رابعت (original: رابعة)
  "\u0631\u0627\u0628\u0639",   // رابع (original: رابع)
  // fifth
  "\u062E\u0627\u0645\u0633\u062A", // خامست (original: خامسة)
  "\u062E\u0627\u0645\u0633",   // خامس (original: خامس)
  // sixth
  "\u0633\u0627\u062F\u0633\u062A", // سادست (original: سادسة)
  "\u0633\u0627\u062F\u0633",   // سادس (original: سادس)
  // seventh
  "\u0633\u0627\u0628\u0639\u062A", // سابعت (original: سابعة)
  "\u0633\u0627\u0628\u0639",   // سابع (original: سابع)
  // eighth
  "\u062B\u0627\u0645\u0646\u062A", // ثامنت (original: ثامنة)
  "\u062B\u0627\u0645\u0646",   // ثامن (original: ثامن)
  // ninth
  "\u062A\u0627\u0633\u0639\u062A", // تاسعت (original: تاسعة)
  "\u062A\u0627\u0633\u0639",   // تاسع (original: تاسع)
  // tenth
  "\u0639\u0627\u0634\u0631\u062A", // عاشرت (original: عاشرة)
  "\u0639\u0627\u0634\u0631",   // عاشر (original: عاشر)
  // new
  "\u062C\u062F\u064A\u062F\u062A", // جديدت (original: جديدة)
  "\u062C\u062F\u064A\u062F",   // جديد (original: جديد)
  // مرة (once/time) - used in "مرة أخرى"
  "\u0645\u0631\u0629",         // مره (original: مرة)
]);

function removeNewsNoiseWords(words) {
  return words.filter((w) => !NEWS_NOISE_WORDS.has(w));
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
  const words = normalized
    .split(/\s+/)
    .filter((w) => w.length > 1 && ARABIC_REGEX_NOG.test(w));
  return removeNewsNoiseWords(words);
}

module.exports = { detectArabic, removeTashkeel, normalizeArabic, removeNewsNoiseWords, getArabicWords };