const emojiRegex = require("emoji-regex");

const ARABIC_DECORATIVE_REGEX = /[\u0640\uFDFF\uFDF0\uFDF1\uFDF2\uFDF3\uFDF4\uFDFD\uFDE0-\uFDEF\u200C\u200E\u200F\uFE0E\uFE0F\u200D]/g;

const NEWS_MARKER_REGEX = /[⚡🔴📢📰‼⁉〖〗【】«»▶◀►◄●○◆◇★☆✦✧✪✫✬✭✮✯✰]/gu;

function cleanText(text) {
  return text
    .replace(emojiRegex(), "")
    .replace(ARABIC_DECORATIVE_REGEX, "")
    .replace(NEWS_MARKER_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TASHKEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

const ALEF_VARIANTS = { "\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627", "\u0671": "\u0627" };
const YA_NORMALIZE = { "\u0649": "\u064A" };

const ARABIC_INDIC_DIGITS = {
  "\u0660": "0", "\u0661": "1", "\u0662": "2", "\u0663": "3", "\u0664": "4",
  "\u0665": "5", "\u0666": "6", "\u0667": "7", "\u0668": "8", "\u0669": "9",
};

const LIGATURES = { "\uFDF2": "\u0627\u0644\u0644\u0647", "\uFDF3": "\u0645\u062D\u0645\u062F" };

function normalizeArabic(text) {
  let result = text;

  for (const [lig, expanded] of Object.entries(LIGATURES)) {
    result = result.replace(new RegExp(lig, "g"), expanded);
  }

  result = result.replace(TASHKEEL_REGEX, "");

  for (const [variant, base] of Object.entries(ALEF_VARIANTS)) {
    result = result.replace(new RegExp(variant, "g"), base);
  }

  for (const [ya, normalized] of Object.entries(YA_NORMALIZE)) {
    result = result.replace(new RegExp(ya, "g"), normalized);
  }

  for (const [arabicDigit, latinDigit] of Object.entries(ARABIC_INDIC_DIGITS)) {
    result = result.replace(new RegExp(arabicDigit, "g"), latinDigit);
  }

  return result.replace(/\s+/g, " ").trim();
}

function processText(text) {
  return normalizeArabic(cleanText(text));
}

module.exports = { cleanText, normalizeArabic, processText };