const config = require("../config");
const { getClient, resolveEntity } = require("../client/telegram");
const registry = require("./channelRegistry");
const { getEngine } = require("./dedupEngine");

const feedCache = new Map();
const CACHE_TTL_MULTIPLIER = 2;

async function getFeed(options = {}) {
  const limit = Math.min(
    options.limit || config.feed.defaultLimit,
    config.feed.maxLimit
  );
  const hours = options.hours || config.feed.defaultHours;
  const channelFilter = options.channel
    ? options.channel.split(",").map((c) => parseInt(c))
    : null;

  const enabledChannels = registry.getAllEnabled();

  const targetChannels = channelFilter
    ? enabledChannels.filter((c) => channelFilter.includes(c.uid))
    : enabledChannels;

  if (targetChannels.length === 0) {
    return {
      success: true,
      data: [],
      meta: {
        totalFetched: 0,
        duplicatesRemoved: 0,
        uniqueReturned: 0,
        channelsSourced: [],
        windowHours: hours,
      },
    };
  }

  const cacheKey = `${limit}:${hours}:${targetChannels.map((c) => c.uid).join(",")}`;
  const now = Math.floor(Date.now() / 1000);
  const cached = feedCache.get(cacheKey);
  if (cached && now - cached.timestamp < hours * 3600 * CACHE_TTL_MULTIPLIER) {
    return cached.result;
  }

  const windowStart = now - hours * 3600;

  const fetchPromises = targetChannels.map(async (channel) => {
    try {
      const client = await getClient();
      const entity = await resolveEntity(channel.telegramId);

      const messages = await client.getMessages(entity, { limit: limit * 3 });

      return messages
        .filter((m) => {
          if (!m || !m.text) return false;
          if (m.media) return false;
          if (m.text.match(/https?:\/\/[^\s]+/i)) return false;
          if (Number(m.date) < windowStart) return false;
          return true;
        })
        .map((m) => ({
          id: Number(m.id),
          channelUid: channel.uid,
          channelName: channel.name,
          channelUsername: channel.username,
          date: Number(m.date),
          text: m.text,
          replyTo: m.replyTo ? Number(m.replyTo.replyToMsgId) : null,
          forwardFrom: m.forward?.fromId?.userId ? Number(m.forward.fromId.userId.value) : null,
        }));
    } catch (err) {
      console.error(`Failed to fetch from channel ${channel.uid} (${channel.name}):`, err.message);
      return [];
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  const allMessages = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .flat();

  const engine = config.dedup.enabled ? getEngine() : null;

  let duplicatesRemoved = 0;
  const channelsSourcedSet = new Set();

  const processedMessages = allMessages.map((msg) => {
    channelsSourcedSet.add(msg.channelUid);

    if (!engine) {
      return { ...msg, isDuplicate: false, duplicateOf: null, originalChannel: null };
    }

    const result = engine.checkDuplicate(msg.text, msg.id, msg.channelUid, msg.date);

    if (result.isDuplicate) {
      duplicatesRemoved++;
      return {
        ...msg,
        isDuplicate: true,
        duplicateOf: result.duplicateOf,
        originalChannel: result.originalChannel,
        similarity: result.similarity,
      };
    }

    return { ...msg, isDuplicate: false, duplicateOf: null, originalChannel: null };
  });

  engine?.cleanup(now);

  processedMessages.sort((a, b) => b.date - a.date);

  const uniqueReturned = processedMessages.filter((m) => !m.isDuplicate).length;
  const finalMessages = processedMessages.slice(0, limit);

  const result = {
    success: true,
    data: finalMessages,
    meta: {
      totalFetched: allMessages.length,
      duplicatesRemoved,
      uniqueReturned,
      channelsSourced: Array.from(channelsSourcedSet),
      windowHours: hours,
    },
  };

  feedCache.set(cacheKey, { result, timestamp: now });
  return result;
}

module.exports = { getFeed };