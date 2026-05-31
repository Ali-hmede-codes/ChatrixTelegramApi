const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const config = require("../config");

let client = null;

async function getClient() {
  if (client && client.connected) return client;

  const stringSession = new StringSession(config.telegram.session);
  client = new TelegramClient(stringSession, config.telegram.apiId, config.telegram.apiHash, {
    connectionRetries: config.telegram.connectionRetries,
    requestRetries: config.telegram.requestRetries,
    downloadRetries: config.telegram.downloadRetries,
    useWSS: config.telegram.useWSS,
    timeout: config.telegram.timeout,
    floodSleepThreshold: config.telegram.floodSleepThreshold,
  });

  await client.connect();
  return client;
}

async function disconnect() {
  if (client) {
    await client.disconnect();
    client = null;
  }
}

function isConnected() {
  return client && client.connected;
}

async function resolveEntity(identifier) {
  const c = await getClient();
  if (/^-?\d+$/.test(identifier)) {
    try {
      return await c.getEntity(BigInt(identifier));
    } catch {
      return BigInt(identifier);
    }
  }
  return await c.getEntity(identifier);
}

module.exports = { getClient, disconnect, isConnected, resolveEntity };