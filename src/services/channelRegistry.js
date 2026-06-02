const fs = require("fs");
const path = require("path");
const config = require("../config");

const REGISTRY_FILE = path.join(process.cwd(), config.media.dir, "..", "channel_registry.json");

let registry = {};
let nextUid = 1;

function load() {
  if (fs.existsSync(REGISTRY_FILE)) {
    const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    registry = data.registry || {};
    nextUid = data.nextUid || 1;

    for (const [uid, entry] of Object.entries(registry)) {
      if (entry.enabled === undefined) {
        entry.enabled = true;
      }
    }
    save();
  }
}

function save() {
  const dir = path.dirname(REGISTRY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify({ registry, nextUid }, null, 2));
}

function assignUid(channelId, name, username) {
  const existing = Object.entries(registry).find(
    ([, v]) => v.telegramId === String(channelId)
  );
  if (existing) return parseInt(existing[0]);

  const uid = nextUid++;
  registry[uid] = {
    telegramId: String(channelId),
    name: name || "",
    username: username || null,
    enabled: true,
  };
  save();
  return uid;
}

function getByUid(uid) {
  return registry[parseInt(uid)] || null;
}

function getByTelegramId(telegramId) {
  const entry = Object.entries(registry).find(
    ([, v]) => v.telegramId === String(telegramId)
  );
  return entry ? { uid: parseInt(entry[0]), ...entry[1] } : null;
}

function getAll() {
  return Object.entries(registry).map(([uid, v]) => ({
    uid: parseInt(uid),
    telegramId: v.telegramId,
    name: v.name,
    username: v.username,
    enabled: v.enabled !== undefined ? v.enabled : true,
  }));
}

function getAllEnabled() {
  return getAll().filter((c) => c.enabled);
}

function toggleEnabled(uid) {
  const key = parseInt(uid);
  const entry = registry[key];
  if (!entry) return null;

  entry.enabled = entry.enabled !== undefined ? !entry.enabled : false;
  save();
  return { uid: key, ...entry };
}

function resolveIdentifier(identifier) {
  const asUid = getByUid(identifier);
  if (asUid) return asUid.telegramId;

  const asTelegramId = getByTelegramId(identifier);
  if (asTelegramId) return identifier;

  return identifier;
}

load();

function removeByUid(uid) {
  const key = parseInt(uid);
  if (registry[key]) {
    delete registry[key];
    save();
    return true;
  }
  return false;
}

function syncRegistry(activeTelegramIds) {
  const activeSet = new Set(activeTelegramIds.map(String));
  let changed = false;
  for (const [uid, entry] of Object.entries(registry)) {
    if (!activeSet.has(entry.telegramId)) {
      delete registry[uid];
      changed = true;
    }
  }
  if (changed) save();
}

module.exports = { assignUid, getByUid, getByTelegramId, getAll, getAllEnabled, toggleEnabled, resolveIdentifier, save, removeByUid, syncRegistry };