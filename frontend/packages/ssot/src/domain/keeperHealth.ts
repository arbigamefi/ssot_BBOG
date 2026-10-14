/**
 * The keeper writes its health snapshot (apps/keeper/src/health.ts) and the web reads it (ops page, /healthz).
 * Both sides use these lists: the keeper's type check fails when its snapshot types and these lists diverge, and
 * the web rejects any field or degraded source that is not listed.
 */
export const KEEPER_HEALTH_SNAPSHOT_FIELDS = [
  "schemaVersion",
  "status",
  "role",
  "chainId",
  "gameHub",
  "vrfHub",
  "keeper",
  "startedAt",
  "updatedAt",
  "lastScannedBlock",
  "lastScanAt",
  "queueDepth",
  "lastEnqueuedAt",
  "lastEnqueued",
  "lastFinalizeSuccessAt",
  "lastFinalizeSuccess",
  "lastFinalizeFailureAt",
  "lastFinalizeFailure",
  "lastError",
  "scanHeadBehindBy",
  "pools",
  "lastPoolScanAt",
  "payables",
  "vaultProviderLedger",
  "governance",
  "voids",
  "casinoRecoveryScannedThrough",
  "degradedBy",
  "rpc"
] as const;

/** Fields of one entry of `pools`. */
export const KEEPER_POOL_HEALTH_FIELDS = [
  "bank",
  "vault",
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
  "PP",
  "accountingValid",
  "paused",
  "lpStatus",
  "error",
  "transientError",
  "transientSince"
] as const;

/** Values of `degradedBy`: the keeper's failure sources and the stall marker. */
export const KEEPER_DEGRADED_SOURCES = [
  "scan",
  "ledger",
  "finalize",
  "recovery",
  "pools",
  "payables",
  "void",
  "unbookedResult",
  "governance",
  "stalled"
] as const;

export type KeeperHealthSnapshotField = (typeof KEEPER_HEALTH_SNAPSHOT_FIELDS)[number];
export type KeeperPoolHealthField = (typeof KEEPER_POOL_HEALTH_FIELDS)[number];
export type KeeperDegradedSource = (typeof KEEPER_DEGRADED_SOURCES)[number];
