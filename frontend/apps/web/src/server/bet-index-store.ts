import { createPostgresBetIndexStore, type BetIndexStore } from "@ssot/bet-index";

let store: BetIndexStore | null | undefined;

function envValue(name: string) {
  const trimmed = process.env[name]?.trim();
  return trimmed ? trimmed : undefined;
}

function envFlag(name: string, values: readonly string[]) {
  return values.includes((process.env[name] ?? "").trim().toLowerCase());
}

/** The durable bet index, or null when BET_INDEX_DATABASE_URL is unset or reads are disabled. */
export function getServerBetIndexStore(): BetIndexStore | null {
  if (store !== undefined) return store;
  const connectionString = envValue("BET_INDEX_DATABASE_URL");
  store =
    !connectionString || envFlag("BET_INDEX_READ_ENABLED", ["0", "false", "no", "off"])
      ? null
      : createPostgresBetIndexStore({
          connectionString,
          ssl: envFlag("BET_INDEX_SSL", ["1", "true", "yes", "on"])
        });
  return store;
}

export function resetServerBetIndexStore() {
  store = undefined;
}
