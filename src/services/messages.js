const config = require("../config");
const { getClient, resolveEntity } = require("../client/telegram");

const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

function stripEmojis(text) {
  return text.replace(EMOJI_REGEX, "").replace(/\s+/g, " ").trim();
}

function formatMessage(msg) {
  const result = {
    id: Number(msg.id),
    date: Number(msg.date),
    text: stripEmojis(msg.text || ""),
    replyTo: msg.replyTo ? Number(msg.replyTo.replyToMsgId) : null,
    forwardFrom: msg.forward?.fromId?.userId ? Number(msg.forward.fromId.userId.value) : null,
  };

  if (msg.media) {
    result.media = {
      type: msg.media.className,
    };

    if (msg.media.photo) {
      result.media.type = "photo";
    } else if (msg.media.document) {
      const doc = msg.media.document;
      result.media.type = doc.mimeType?.startsWith("video/") ? "video" : "document";
      result.media.mimeType = doc.mimeType || null;
      result.media.fileName = doc.attributes?.find((a) => a.fileName)?.fileName || null;
      result.media.size = Number(doc.size?.value || doc.size || 0);
    }
  }

  return result;
}

function shouldSkip(msg) {
  if (msg.media) return true;
  const text = msg.text || "";
  if (text.match(/https?:\/\/[^\s]+/i)) return true;
  return false;
}

async function getMessages(identifier, limit, offsetId) {
  const client = await getClient();
  const entity = await resolveEntity(identifier);

  const effectiveLimit = Math.min(limit || config.messages.defaultLimit, config.messages.maxLimit);

  const fetchLimit = effectiveLimit * 3;

  const messages = await client.getMessages(entity, {
    limit: fetchLimit,
    offsetId: offsetId || 0,
  });

  const filtered = messages.filter((m) => !shouldSkip(m));
  return filtered.slice(0, effectiveLimit).map(formatMessage);
}

async function getMessage(identifier, messageId) {
  const client = await getClient();
  const entity = await resolveEntity(identifier);

  const messages = await client.getMessages(entity, { ids: [messageId] });
  if (!messages[0]) return null;

  return formatMessage(messages[0]);
}

module.exports = { getMessages, getMessage, formatMessage };