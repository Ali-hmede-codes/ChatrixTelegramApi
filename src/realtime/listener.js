const EventEmitter = require("events");
const { NewMessage } = require("telegram/events");
const { getClient } = require("../client/telegram");
const { formatMessage } = require("../services/messages");
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