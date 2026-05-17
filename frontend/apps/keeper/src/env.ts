import { readFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import type { KeeperConfig, KeeperRole } from "./types.js";

type ReleaseLike = {
  chainId: number;
  contracts: {
    gameHub: Address;
    vrfHub: Address;
  };
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

function parseBlockCount(value: string | undefined, fallback: bigint) {
  if (!value) return fallback;
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error("KEEPER_SCAN_CHUNK_BLOCKS must be greater than zero");
  return parsed;
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

  return {
    chainId,
    gameHub: release.contracts.gameHub,
    vrfHub: release.contracts.vrfHub,
    httpRpcUrl: requireEnv(env, "KEEPER_RPC_HTTP"),
    wsRpcUrl: env.KEEPER_RPC_WS?.trim() || undefined,
    privateKey: requireEnv(env, "KEEPER_PRIVATE_KEY") as Hex,
    role: parseRole(env.KEEPER_ROLE),
    backupDelayMs: parseMs(env.KEEPER_BACKUP_DELAY_SECONDS, 0),
    pollIntervalMs: parseMs(env.KEEPER_POLL_INTERVAL_SECONDS, 15_000),
    scanChunkBlocks: parseBlockCount(env.KEEPER_SCAN_CHUNK_BLOCKS, 10n),
    startBlock:
      parseOptionalBlock(env.KEEPER_START_BLOCK) ?? BigInt(release.meta?.blockNumber ?? 0),
    healthPath: env.KEEPER_HEALTH_PATH?.trim() || undefined,
    betIndexDatabaseUrl: env.BET_INDEX_DATABASE_URL?.trim() || undefined,
    betIndexSsl: parseBool(env.BET_INDEX_SSL),
    betIndexWriteEnabled: parseBool(env.BET_INDEX_WRITE_ENABLED)
  };
}
