import { loadKeeperConfig } from "./env.js";
import { logger } from "./logger.js";
import { createKeeperRuntime } from "./runtime.js";

async function main() {
  const config = loadKeeperConfig();
  const keeper = createKeeperRuntime({ config, logger });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await keeper.stop();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  await keeper.start();
}

main().catch((error) => {
  logger.error("casino.keeper.fatal", {
    message: (error as Error)?.message ?? "unknown error"
  });
  process.exit(1);
});
