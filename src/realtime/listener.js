const EventEmitter = require("events");
const { NewMessage } = require("telegram/events");
const { getClient } = require("../client/telegram");
const { formatMessage } = require("../services/messages");
const { checkDuplicate } = require("../services/newsDedup");
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

    const formatted = formatMessage(message);
    formatted.channelId = channelId;

    if (config.dedup?.enabled) {
      const dedupResult = checkDuplicate(formatted, formatted.date * 1000);
      formatted.isDuplicate = dedupResult.isDuplicate;
      if (dedupResult.isDuplicate) {
        formatted.duplicateOf = dedupResult.duplicateOf;
        formatted.duplicateChannel = dedupResult.duplicateChannel;
        formatted.similarity = dedupResult.similarity;
      }

      if (dedupResult.isDuplicate && config.dedup?.skipDuplicates) {
        return;
      }
    }

    emitter.emit("message", formatted);
  }, new NewMessage({}));

  console.log("Real-time listener started");
}

function onMessage(callback) {
  emitter.on("message", callback);
}

function offMessage(callback) {
  emitter.off("message", callback);
}

module.exports = { startListening, onMessage, offMessage, emitter };