import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type KeeperHealthSnapshot = {
  schemaVersion: 1;
  status: "starting" | "running" | "degraded" | "stopped";
  role: "primary" | "backup";
  chainId: number;
  gameHub: string;
  vrfHub: string;
  keeper: string;
  startedAt: string;
  updatedAt: string;
  queueDepth: number;
  lastScannedBlock?: string;
  lastScanAt?: string;
  lastEnqueuedAt?: string;
  lastEnqueued?: {
    source: string;
    betId: string;
    requestId?: string;
    blockNumber?: string;
    txHash?: string;
  };
  lastFinalizeSuccessAt?: string;
  lastFinalizeSuccess?: { betId: string; txHash: string; latencyMs: number };
  lastFinalizeFailureAt?: string;
  lastFinalizeFailure?: { betId: string; reason: string; retryable: boolean };
  lastError?: string;
  pools?: KeeperPoolHealth[];
  lastPoolScanAt?: string;
  payables?: Array<{
    bank: string;
    scannedThrough?: string;
    finalizedBlock?: string;
    headBlock?: string;
    caughtUp: boolean;
    pending: number;
    readError?: string;
    claimError?: string;
    error?: string;
  }>;
  casinoRecoveryScannedThrough?: string;
  degradedBy?: Array<
    "scan" | "ledger" | "finalize" | "recovery" | "pools" | "payables" | "stalled"
  >;
  rpc?: {
    errorsLastMinute: Record<string, number>;
    lastMinute: Record<string, number>;
    total: Record<string, number>;
    totalErrors: Record<string, number>;
    windowStartedAt: string;
    updatedAt: string;
  };
};

function repoRoot() {
  return path.resolve(process.cwd(), "../../..");
}

function defaultHealthPath(chainId: number) {
  return path.resolve(process.cwd(), `../../.runtime/casino-keeper-health-${chainId}.json`);
}

function defaultGenericHealthPath() {
  return path.resolve(process.cwd(), "../../.runtime/casino-keeper-health.json");
}

function resolveHealthPathCandidate(candidate: string) {
  if (path.isAbsolute(candidate)) return [candidate];
  return [path.resolve(repoRoot(), candidate), path.resolve(process.cwd(), candidate)];
}

function healthPathCandidates(chainId: number) {
  const candidates: string[] = [];
  const seen = new Set<string>();
  let hasConfiguredPath = false;
  const push = (paths: string[]) => {
    for (const filePath of paths) {
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      candidates.push(filePath);
    }
  };

  const chainSpecific = process.env[`KEEPER_HEALTH_PATH_${chainId}`]?.trim();
  if (chainSpecific) {
    hasConfiguredPath = true;
    push(resolveHealthPathCandidate(chainSpecific));
  }

  const configured = process.env.KEEPER_HEALTH_PATH?.trim();
  if (configured) {
    hasConfiguredPath = true;
    push(resolveHealthPathCandidate(configured));
  }

  if (hasConfiguredPath) return candidates;

  push([defaultHealthPath(chainId)]);
  push([defaultGenericHealthPath()]);

  return candidates;
}

async function readJsonFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export type KeeperPoolHealth = {
  bank: string;
  vault: string;
  observedBlock?: string;
  openHolds?: string;
  maxOpenHolds?: string;
  capacityHeadroom?: string;
  minBetAmount?: string;
  bankCash?: string;
  vaultCash?: string;
  L?: string;
  P?: string;
  R?: string;
  K?: string;
  G?: string;
  PF?: string;
  XP?: string;
  PP?: string;
  accountingValid?: boolean;
  paused?: boolean;
  lpStatus?: number;
  error?: string;
};
const SNAPSHOT_KEYS = new Set([
  "schemaVersion",
  "status",
  "role",
  "chainId",
  "gameHub",
  "vrfHub",
  "keeper",
  "startedAt",
  "updatedAt",
  "queueDepth",
  "lastScannedBlock",
  "lastScanAt",
  "lastEnqueuedAt",
  "lastEnqueued",
  "lastFinalizeSuccessAt",
  "lastFinalizeSuccess",
  "lastFinalizeFailureAt",
  "lastFinalizeFailure",
  "lastError",
  "pools",
  "lastPoolScanAt",
  "payables",
  "casinoRecoveryScannedThrough",
  "degradedBy",
  "rpc"
]);
const POOL_NUMBERS = [
  "observedBlock",
  "openHolds",
  "maxOpenHolds",
  "capacityHeadroom",
  "minBetAmount",
  "bankCash",
  "vaultCash",
  "L",
  "P",
  "R",
  "K",
  "G",
  "PF",
  "XP",
  "PP"
] as const;
const POOL_KEYS = new Set([
  "bank",
  "vault",
  ...POOL_NUMBERS,
  "accountingValid",
  "paused",
  "lpStatus",
  "error"
]);
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function address(value: unknown) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}
function validSnapshot(value: unknown, chainId: number): value is KeeperHealthSnapshot {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !SNAPSHOT_KEYS.has(key)) ||
    value.schemaVersion !== 1 ||
    value.chainId !== chainId ||
    !["starting", "running", "degraded", "stopped"].includes(String(value.status)) ||
    !["primary", "backup"].includes(String(value.role)) ||
    !address(value.gameHub) ||
    !address(value.vrfHub) ||
    !address(value.keeper) ||
    typeof value.startedAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.queueDepth !== "number" ||
    !Number.isSafeInteger(value.queueDepth) ||
    value.queueDepth < 0
  )
    return false;
  if (
    value.degradedBy !== undefined &&
    (!Array.isArray(value.degradedBy) ||
      value.degradedBy.some(
        (item) =>
          !["scan", "ledger", "finalize", "recovery", "pools", "payables", "stalled"].includes(
            String(item)
          )
      ))
  )
    return false;
  return (
    value.pools === undefined ||
    (Array.isArray(value.pools) &&
      value.pools.every(
        (pool) =>
          record(pool) &&
          Object.keys(pool).every((key) => POOL_KEYS.has(key)) &&
          address(pool.bank) &&
          address(pool.vault) &&
          POOL_NUMBERS.every(
            (key) =>
              pool[key] === undefined ||
              (typeof pool[key] === "string" && /^\d+$/.test(pool[key] as string))
          ) &&
          (pool.accountingValid === undefined || typeof pool.accountingValid === "boolean") &&
          (pool.paused === undefined || typeof pool.paused === "boolean") &&
          (pool.lpStatus === undefined ||
            (typeof pool.lpStatus === "number" &&
              Number.isInteger(pool.lpStatus) &&
              pool.lpStatus >= 0 &&
              pool.lpStatus <= 7))
      ))
  );
}

export async function readKeeperHealthSnapshot({
  chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532")
}: {
  chainId?: number;
} = {}): Promise<KeeperHealthSnapshot> {
  for (const candidate of healthPathCandidates(chainId)) {
    const snapshot = await readJsonFile(candidate);
    if (validSnapshot(snapshot, chainId)) {
      return snapshot as KeeperHealthSnapshot;
    }
  }

  const loaded = loadEmbeddedRelease(chainId);
  const release = loaded.ok ? loaded.release : undefined;
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    status: "stopped",
    role: "primary",
    chainId: Number(release?.chainId ?? chainId),
    gameHub: release?.contracts?.gameHub ?? ZERO_ADDRESS,
    vrfHub: release?.contracts?.vrfHub ?? ZERO_ADDRESS,
    keeper: ZERO_ADDRESS,
    startedAt: now,
    updatedAt: now,
    queueDepth: 0
  };
}
