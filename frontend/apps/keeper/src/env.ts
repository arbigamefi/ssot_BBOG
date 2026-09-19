import { readFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";
import type { KeeperConfig, KeeperRole } from "./types.js";

type ReleaseLike = {
  chainId: number;
  contracts: {
    gameHub: Address;
    sportsHub?: Address;
    vrfHub: Address;
  };
  pools?: Array<{
    active?: boolean;
    asset: Address;
    bank: Address;
    decimals?: number;
    poolId: number;
  }>;
  meta?: {
    blockNumber?: number;
  };
};

function requireEnv(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function parseRole(value: string | undefined): KeeperRole {
  return value === "backup" ? "backup" : "primary";
}

function parseMs(seconds: string | undefined, fallback: number) {
  const parsed = Number(seconds ?? "");
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed * 1000);
}

function parseMilliseconds(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return Math.floor(parsed);
}

function parseOptionalBlock(value: string | undefined) {
  if (!value) return undefined;
  return BigInt(value);
}

function parseBool(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}

function parseBoolWithDefault(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === "") return fallback;
  return parseBool(value);
}

function parseBlockCount(value: string | undefined, fallback: bigint, name: string) {
  if (!value) return fallback;
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero`);
  return parsed;
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseBigintList(value: string | undefined, name: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const parsed = BigInt(part);
      if (parsed <= 0n) throw new Error(`${name} must contain positive integer ids`);
      return parsed;
    });
}

function resolveBankProviderLedgerPools(release: ReleaseLike) {
  return (release.pools ?? [])
    .filter((pool) => pool.active !== false)
    .map((pool) => ({
      asset: getAddress(pool.asset),
      bank: getAddress(pool.bank),
      decimals: pool.decimals ?? 6,
      poolId: pool.poolId
    }));
}

export function loadRelease(path: string): ReleaseLike {
  const raw = JSON.parse(readFileSync(path, "utf8")) as ReleaseLike;
  if (!raw.chainId || !raw.contracts?.gameHub || !raw.contracts?.vrfHub) {
    throw new Error(`Invalid keeper release file: ${path}`);
  }
  return raw;
}

export function loadKeeperConfig(env: NodeJS.ProcessEnv = process.env): KeeperConfig {
  const releasePath = requireEnv(env, "KEEPER_RELEASE_PATH");
  const release = loadRelease(releasePath);
  const chainId = Number(env.KEEPER_CHAIN_ID ?? release.chainId);
  if (chainId !== release.chainId) {
    throw new Error(`KEEPER_CHAIN_ID=${chainId} does not match release chainId=${release.chainId}`);
  }
  const scanChunkBlocks = parseBlockCount(
    env.KEEPER_SCAN_CHUNK_BLOCKS,
    10n,
    "KEEPER_SCAN_CHUNK_BLOCKS"
  );

  return {
    chainId,
    gameHub: release.contracts.gameHub,
    sportsHub: release.contracts.sportsHub,
    vrfHub: release.contracts.vrfHub,
    httpRpcUrl: requireEnv(env, "KEEPER_RPC_HTTP"),
    wsRpcUrl: env.KEEPER_RPC_WS?.trim() || undefined,
    privateKey: requireEnv(env, "KEEPER_PRIVATE_KEY") as Hex,
    role: parseRole(env.KEEPER_ROLE),
    backupDelayMs: parseMs(env.KEEPER_BACKUP_DELAY_SECONDS, 0),
    pollIntervalMs: parseMs(env.KEEPER_POLL_INTERVAL_SECONDS, 15_000),
    rpcMinIntervalMs: parseMilliseconds(
      env.KEEPER_RPC_MIN_INTERVAL_MS,
      0,
      "KEEPER_RPC_MIN_INTERVAL_MS"
    ),
    scanChunkBlocks,
    // Left unbounded, a cursor that has fallen months behind turns one pass into
    // hundreds of thousands of `eth_getLogs` calls and drains a provider quota
    // outright. Note a chunk is not one request: with scanIndexEventsEnabled a
    // gamehub chunk costs five (`BetRandomReady`, then the four index events),
    // and a bank-ledger chunk costs one per configured pool.
    //
    // The default keeps a healthy keeper comfortable while refusing to grind: at
    // the free-tier 10-block chunk size a 300s pass only needs ~15 chunks to keep
    // pace with Base, so 50 leaves 3x headroom and still drains short outages
    // quickly. A backlog large enough to stay capped for days is an operator
    // decision (fast-forward the cursor), not something to burn quota on — which
    // is what `casino.keeper.scan_capped` is there to surface.
    scanMaxChunksPerPass: parsePositiveInteger(
      env.KEEPER_SCAN_MAX_CHUNKS_PER_PASS,
      50,
      "KEEPER_SCAN_MAX_CHUNKS_PER_PASS"
    ),
    scanIndexEventsEnabled: parseBoolWithDefault(env.KEEPER_SCAN_INDEX_EVENTS_ENABLED, true),
    startupScanEnabled: parseBoolWithDefault(env.KEEPER_STARTUP_SCAN_ENABLED, true),
    startBlock:
      parseOptionalBlock(env.KEEPER_START_BLOCK) ?? BigInt(release.meta?.blockNumber ?? 0),
    healthPath: env.KEEPER_HEALTH_PATH?.trim() || undefined,
    betIndexDatabaseUrl: env.BET_INDEX_DATABASE_URL?.trim() || undefined,
    betIndexSsl: parseBool(env.BET_INDEX_SSL),
    betIndexWriteEnabled: parseBool(env.BET_INDEX_WRITE_ENABLED),
    bankProviderLedgerPools: resolveBankProviderLedgerPools(release),
    bankProviderLedgerScanIntervalMs: parseMs(
      env.KEEPER_BANK_PROVIDER_LEDGER_SCAN_INTERVAL_SECONDS,
      60_000
    ),
    sportsTicketIndexEnabled: parseBool(env.KEEPER_SPORTS_TICKET_INDEX_ENABLED),
    sportsTerminalizerEnabled: parseBool(env.KEEPER_SPORTS_TERMINALIZER_ENABLED),
    sportsTerminalizerScanChunkBlocks: parseBlockCount(
      env.KEEPER_SPORTS_TERMINALIZER_SCAN_CHUNK_BLOCKS,
      scanChunkBlocks,
      "KEEPER_SPORTS_TERMINALIZER_SCAN_CHUNK_BLOCKS"
    ),
    sportsTerminalizerMarketIds: parseBigintList(
      env.KEEPER_SPORTS_TERMINALIZER_MARKET_IDS,
      "KEEPER_SPORTS_TERMINALIZER_MARKET_IDS"
    ),
    sportsTerminalizerMaxTicketsPerMarket: parsePositiveInteger(
      env.KEEPER_SPORTS_TERMINALIZER_MAX_TICKETS_PER_MARKET,
      200,
      "KEEPER_SPORTS_TERMINALIZER_MAX_TICKETS_PER_MARKET"
    ),
    sportsTicketEnumerationMax: parsePositiveInteger(
      env.KEEPER_SPORTS_TICKET_ENUMERATION_MAX,
      500,
      "KEEPER_SPORTS_TICKET_ENUMERATION_MAX"
    ),
    sportsTicketScanChunkBlocks: parseBlockCount(
      env.KEEPER_SPORTS_TICKET_SCAN_CHUNK_BLOCKS,
      scanChunkBlocks,
      "KEEPER_SPORTS_TICKET_SCAN_CHUNK_BLOCKS"
    ),
    // The ticket log fallback rescans from a fixed start block on every call,
    // so its range grows without limit as the deployment ages: on Base mainnet
    // the default start is the release block, already ~4.5M blocks back, which
    // at a 10-block chunk size is ~450k eth_getLogs per call — and it runs per
    // market terminalization attempt, retried up to 8 times.
    //
    // This bounds the range the fallback may attempt. It is deliberately a
    // refusal, not a narrower window: silently scanning only recent blocks
    // would miss older tickets and hand the terminalizer a short list, which
    // it would settle as if complete. ~1.2 days of Base blocks is enough for a
    // market that terminalizes near its last ticket; anything wider means the
    // ticket index should be doing this instead.
    sportsTicketScanMaxBlocks: parseBlockCount(
      env.KEEPER_SPORTS_TICKET_SCAN_MAX_BLOCKS,
      50_000n,
      "KEEPER_SPORTS_TICKET_SCAN_MAX_BLOCKS"
    ),
    sportsTicketScanStartBlock:
      parseOptionalBlock(env.KEEPER_SPORTS_TICKET_SCAN_START_BLOCK) ??
      BigInt(release.meta?.blockNumber ?? 0)
  };
}
