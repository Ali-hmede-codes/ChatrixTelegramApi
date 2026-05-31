const { app, initialize } = require("./src/app");
const config = require("./src/config");
const { disconnect } = require("./src/client/telegram");

const server = app.listen(config.server.port, config.server.host, async () => {
  console.log(`API running on http://${config.server.host}:${config.server.port}`);

  try {
    await initialize();
  } catch (err) {
    console.error("Failed to connect to Telegram:", err.message);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await disconnect();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down...");
  await disconnect();
  server.close();
  process.exit(0);
});