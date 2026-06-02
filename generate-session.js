const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const API_ID = 30175496;
const API_HASH = "9fc884afa0d1575572be3b9819218e87";

async function main() {
  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await ask("Enter your phone number: "),
    phoneCode: async () => await ask("Enter the verification code: "),
    password: async () => await ask("Enter your 2FA password (if any): "),
    onError: (err) => console.error(err),
  });

  const session = client.session.save();
  console.log("\n=== YOUR NEW SESSION STRING ===");
  console.log(session);
  console.log("===============================\n");
  console.log("Copy this and replace the SESSION value in your .env file.");

  await client.disconnect();
  rl.close();
}

main().catch(console.error);