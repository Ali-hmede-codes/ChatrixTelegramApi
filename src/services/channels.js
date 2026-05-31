const { getClient, resolveEntity } = require("../client/telegram");
const registry = require("./channelRegistry");

async function listChannels() {
  const client = await getClient();
  const dialogs = await client.getDialogs();

  const channels = dialogs
    .filter((d) => d.isChannel || d.isGroup)
    .map((d) => {
      const telegramId = String(d.id?.value || d.id);
      const uid = registry.assignUid(telegramId, d.name || "", d.entity?.username || null);
      return {
        uid,
        telegramId,
        name: d.name || "",
        username: d.entity?.username || null,
        isChannel: d.isChannel,
        isGroup: d.isGroup,
        memberCount: d.entity?.participantsCount || null,
      };
    });

  const activeIds = channels.map((c) => c.telegramId);
  registry.syncRegistry(activeIds);
  registry.save();
  return channels;
}

async function getChannelByUid(uid) {
  const entry = registry.getByUid(uid);
  if (!entry) return null;

  const client = await getClient();
  const entity = await resolveEntity(entry.telegramId);

  return {
    uid: parseInt(uid),
    telegramId: entry.telegramId,
    name: entity.title || entity.name || entry.name,
    username: entity.username || entry.username,
  };
}

module.exports = { listChannels, getChannelByUid };