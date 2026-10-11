import { readFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";
import type { KeeperConfig, KeeperRole } from "./types.js";
import { DEFAULT_VOID_GAS_LIMIT, MAX_VOID_GAS_LIMIT } from "./void.js";

type ReleaseLike = {
  chainId: number;
  contracts: {
    governanceTimelock: Address;
    gameHub: Address;
    vrfHub: Address;
    poolRegistry: Address;
  };
  pools?: Array<{
    asset: Address;
    bank: Address;
    vault: Address;
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

/** Non-negative seconds as milliseconds; zero disables what it bounds. */
function parseSeconds(value: string | undefined, fallbackSeconds: number, name: string) {
  const text = value?.trim();
  if (!text) return fallbackSeconds * 1000;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`${name} must be a non-negative number of seconds`);
  return Math.floor(parsed * 1000);
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

/** The floor depends on GameHub constants, so startup checks it once they are read. */
function parseVoidGasLimit(value: string | undefined) {
  const text = value?.trim();
  if (!text) return DEFAULT_VOID_GAS_LIMIT;
  if (!/^\d+$/.test(text)) throw new Error("KEEPER_VOID_GAS_LIMIT must be a positive integer");
  const parsed = BigInt(text);
  if (parsed > MAX_VOID_GAS_LIMIT)
    throw new Error(
      `KEEPER_VOID_GAS_LIMIT must be at most ${MAX_VOID_GAS_LIMIT}: Base caps a transaction at 16,777,216 gas`
    );
  return parsed;
}

/** Every pool of the release: LPs deposit before a pool is activated (ADR-0037 §9 D1). */
function resolveVaultProviderLedgerPools(release: ReleaseLike) {
  return (release.pools ?? []).map((pool) => ({
    asset: getAddress(pool.asset),
    bank: getAddress(pool.bank),
    vault: getAddress(pool.vault),
    decimals: pool.decimals ?? 6,
    poolId: pool.poolId
  }));
}

/** Every Bank of the release is governed by the release timelock. */
function resolveReleaseBanks(release: ReleaseLike) {
  return [...new Set((release.pools ?? []).map((pool) => getAddress(pool.bank)))];
}

export function loadRelease(path: string): ReleaseLike {
  const raw = JSON.parse(readFileSync(path, "utf8")) as ReleaseLike;
  if (
    !raw.chainId ||
    !raw.contracts?.governanceTimelock ||
    !raw.contracts?.gameHub ||
    !raw.contracts?.vrfHub ||
    !raw.contracts?.poolRegistry
  ) {
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
  const casinoRecoveryStartBlock =
    parseOptionalBlock(env.KEEPER_CASINO_RECOVERY_START_BLOCK) ??
    BigInt(release.meta?.blockNumber ?? 0);
  if (
    casinoRecoveryStartBlock < 0n ||
    casinoRecoveryStartBlock > BigInt(release.meta?.blockNumber ?? 0)
  ) {
    throw new Error(
      "KEEPER_CASINO_RECOVERY_START_BLOCK must include the release block; advancing it can omit PendingVRF positions"
    );
  }

  return {
    chainId,
    gameHub: release.contracts.gameHub,
    vrfHub: release.contracts.vrfHub,
    poolRegistry: getAddress(release.contracts.poolRegistry),
    governanceTimelock: getAddress(release.contracts.governanceTimelock),
    releaseBanks: resolveReleaseBanks(release),
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
    // a casino chunk reads one combined Hub query plus one canonical VRF query;
    // a Vault-ledger chunk combines all Vault addresses, plus timestamps.
    //
    // The default keeps a healthy keeper comfortable while refusing to grind: at
    // the free-tier 10-block chunk size a 300s pass only needs ~15 chunks to keep
    // pace with Base, so 50 leaves 3x headroom and still drains short outages
    // quickly. Persistent backlog needs an audited recovery plan: the casino
    // cursor also recovers unsettled bets and must not be blindly advanced.
    scanMaxChunksPerPass: parsePositiveInteger(
      env.KEEPER_SCAN_MAX_CHUNKS_PER_PASS,
      50,
      "KEEPER_SCAN_MAX_CHUNKS_PER_PASS"
    ),
    scanIndexEventsEnabled: parseBoolWithDefault(env.KEEPER_SCAN_INDEX_EVENTS_ENABLED, true),
    startupScanEnabled: parseBoolWithDefault(env.KEEPER_STARTUP_SCAN_ENABLED, true),
    startBlock:
      parseOptionalBlock(env.KEEPER_START_BLOCK) ?? BigInt(release.meta?.blockNumber ?? 0),
    // Full lifecycle recovery starts at the release origin, including its first block.
    casinoRecoveryStartBlock,
    healthPath: env.KEEPER_HEALTH_PATH?.trim() || undefined,
    betIndexDatabaseUrl: env.BET_INDEX_DATABASE_URL?.trim() || undefined,
    betIndexSsl: parseBool(env.BET_INDEX_SSL),
    betIndexWriteEnabled: parseBool(env.BET_INDEX_WRITE_ENABLED),
    vaultProviderLedgerPools: resolveVaultProviderLedgerPools(release),
    vaultProviderLedgerScanIntervalMs: parseMs(
      env.KEEPER_VAULT_PROVIDER_LEDGER_SCAN_INTERVAL_SECONDS,
      60_000
    ),
    voidGasLimit: parseVoidGasLimit(env.KEEPER_VOID_GAS_LIMIT),
    // Payables, Vault ledger and governance degrade when finalized has not advanced for this long.
    finalizedStallMs: parseSeconds(
      env.KEEPER_FINALIZED_STALL_SECONDS,
      3_600,
      "KEEPER_FINALIZED_STALL_SECONDS"
    )
  };
}
