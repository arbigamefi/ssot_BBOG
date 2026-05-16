import { loadKeeperConfig } from "./env.js";
import { logger } from "./logger.js";
import { createKeeperRuntime } from "./runtime.js";

async function main() {
  const config = loadKeeperConfig();
  const keeper = createKeeperRuntime({ config, logger });

  const shutdown = () => {
    keeper.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await keeper.start();
}

main().catch((error) => {
  logger.error("casino.keeper.fatal", {
    message: (error as Error)?.message ?? "unknown error"
  });
  process.exit(1);
});
