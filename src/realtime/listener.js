const EventEmitter = require("events");
const { NewMessage } = require("telegram/events");
const { getClient } = require("../client/telegram");
const { formatMessage } = require("../services/messages");
const { getEngine } = require("../services/dedupEngine");
const registry = require("../services/channelRegistry");
const config = require("../config");

const emitter = new EventEmitter();
let listening = false;

async function startListening() {
  if (!config.realtime.enabled) return;
  if (listening) return;

  listening = true;
  const client = await getClient();

  client.addEventHandler((event) => {
    const message = event.message;
    if (!message) return;

    const channelId = String(
      message.peerId?.channelId?.value ||
      message.peerId?.chatId?.value ||
      message.peerId?.userId?.value ||
      ""
    );

    const regEntry = registry.getByTelegramId(channelId);
    if (regEntry && !regEntry.enabled) return;

    const formatted = formatMessage(message);
    formatted.channelId = channelId;
    if (regEntry) formatted.channelUid = regEntry.uid;

    if (config.dedup.enabled && formatted.text && formatted.text.length >= 10) {
      const engine = getEngine();
      const dedupResult = engine.checkDuplicate(
        message.text || "",
        formatted.id,
        formatted.channelUid || 0,
        formatted.date
      );

      if (dedupResult.isDuplicate) {
        formatted.isDuplicate = true;
        formatted.duplicateOf = dedupResult.duplicateOf;
        formatted.originalChannel = dedupResult.originalChannel;
        formatted.similarity = dedupResult.similarity;
        emitter.emit("duplicate", formatted);
      } else {
        formatted.isDuplicate = false;
        emitter.emit("message", formatted);
      }
    } else {
      formatted.isDuplicate = false;
      emitter.emit("message", formatted);
    }
  }, new NewMessage({}));

  console.log("Real-time listener started");
}

function onMessage(callback) {
  emitter.on("message", callback);
}

function offMessage(callback) {
  emitter.off("message", callback);
}

function onDuplicate(callback) {
  emitter.on("duplicate", callback);
}

function offDuplicate(callback) {
  emitter.off("duplicate", callback);
}

module.exports = { startListening, onMessage, offMessage, onDuplicate, offDuplicate, emitter };