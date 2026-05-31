const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const readline = require("readline");

require("dotenv").config();

const API_ID = parseInt(process.env.API_ID || "0");
const API_HASH = process.env.API_HASH || "";

if (!API_ID || !API_HASH) {
  console.error("Set API_ID and API_HASH in .env first.");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

(async () => {
  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: true,
  });

  await client.start({
    phoneNumber: async () => await ask("Phone number (e.g. +15793308883): "),
    password: async () => await ask("2FA password (leave empty if none): "),
    phoneCode: async () => await ask("Enter the code Telegram sent you: "),
    onError: (err) => console.error("Error:", err),
  });

  console.log("\n✅ Login successful!\n");
  console.log("Your session string:\n");
  console.log(stringSession.save());
  console.log("\nSave this as SESSION in your .env file.\n");

  rl.close();
  await client.disconnect();
})();