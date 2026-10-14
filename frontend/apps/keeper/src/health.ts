import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Address, Hex } from "viem";
import type {
  KeeperDegradedSource,
  KeeperHealthSnapshotField,
  KeeperPoolHealthField
} from "@ssot/ssot/keeper-health";

import type { FinalizeOutcome, KeeperConfig, KeeperEvent, KeeperRole } from "./types.js";
import type { VoidAttemptOutcome } from "./void.js";

export type KeeperHealthStatus = "starting" | "running" | "degraded" | "stopped";

/**
 * Where a failure came from. Scans clear on a successful pass that reaches its target; finalization and void failures clear
 * only when the same bet is successfully reconciled, including a healthy deferred read.
 */
export type KeeperFailureSource =
  | "scan"
  | "ledger"
  | "finalize"
  | "recovery"
  | "pools"
  | "payables"
  | "void"
  | "unbookedResult"
  | "governance";

export type PoolHealth = {
  bank: Address;
  vault: Address;
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
  /**
   * Informational: the block-pinned reads reached a node without that block. Becomes `error` after
   * five consecutive minutes.
   */
  transientError?: string;
  transientSince?: string;
};

/** Refused transfers remain owed; discovery and RPC failures require operational attention. */
export type PayableHealth = {
  bank: Address;
  scannedThrough?: string;
  /** Discovery covers finalized blocks only; recent debts wait for chain finality. */
  finalizedBlock?: string;
  /**
   * Informational: the finalized read was this many blocks below an earlier one, as load-balanced RPC
   * nodes can be. Nothing past it was scanned; scanning resumes from the cursor once the RPC catches up.
   */
  finalizedBehindBy?: string;
  /** The finalized head has not advanced since then, longer than KEEPER_FINALIZED_STALL_SECONDS. */
  finalizedStalledSince?: string;
  headBlock?: string;
  caughtUp: boolean;
  pending: number;
  readError?: string;
  /**
   * Informational: a block-pinned read reached a node without that block. Becomes `readError` after
   * five consecutive minutes.
   */
  transientReadError?: string;
  claimError?: string;
  /** The last save to KEEPER_STATE_DIR failed: a restart would replay discovery from the release origin. */
  stateError?: string;
  error?: string;
};

/** Progress of a scan that follows the finalized head. */
export type FinalizedScanHealth = {
  scannedThrough?: string;
  finalizedBlock?: string;
  /** Informational, as in PayableHealth. */
  finalizedBehindBy?: string;
  /** As in PayableHealth; degrades the scan's source. */
  finalizedStalledSince?: string;
};

/** Indexing of the GovernanceTimelock that governs PoolRegistry, GameHub and every Bank. */
export type GovernanceHealth = FinalizedScanHealth & {
  timelock: Address;
  caughtUp: boolean;
};

/** A received result whose settlement reverts, waiting for or being voided. */
export type VoidCandidateHealth = {
  betId: string;
  bank: Address;
  vrfRequestedAt: string;
  /**
   * Unix seconds the result was received: the block of its ResultReceived or BetRandomReady event,
   * or the VRF request time (`request`) when no such event was seen, which can only overstate the age.
   */
  receivedAt: string;
  receivedFrom: "result" | "request";
  eligibleAt: string;
  eligible: boolean;
  reason: string;
};

export type VoidOutcomeName = "voided" | "settled" | "failed" | "configurationError";

/** The keeper as void executor (ADR-0037 §7.3 operating rule 3). */
export type VoidHealth = {
  gasLimit: string;
  /** Oldest VRF request first; at most 50 are listed. */
  candidates: VoidCandidateHealth[];
  candidateCount: number;
  /** Attempts by outcome: voided, settled inside voidBet, or failed (including configuration errors). */
  attempts: number;
  voided: number;
  settled: number;
  failed: number;
  lastOutcomeAt?: string;
  lastOutcome?: {
    betId: string;
    outcome: VoidOutcomeName;
    txHash?: Hex;
    settlementErrorPrefix?: Hex;
    reason?: string;
  };
  /** Set while voidBet runs out of gas at KEEPER_VOID_GAS_LIMIT; cleared by the next mined attempt. */
  configurationError?: string;
  /**
   * The unbooked result received first, its age at the last chain-time read, and when voidBet becomes
   * allowed. Older than one hour degrades `unbookedResult` (ADR-0037 §7.3 rule 4).
   */
  oldestUnbooked?: {
    betId: string;
    receivedAt: string;
    receivedFrom: "result" | "request";
    ageSeconds: string;
    eligibleAt: string;
  };
  /**
   * After a start no bet is voided until lifecycle recovery has reached the head seen at startup and
   * the indexed open bets have been requeued once, so every earlier candidate is known.
   */
  startupRecoveryComplete: boolean;
};

const MAX_VOID_CANDIDATES_LISTED = 50;
/** ADR-0037 §7.3 rule 4: an unbooked result older than this is alerted. */
export const UNBOOKED_RESULT_ALERT_SECONDS = 3_600n;

/** A finalized scan stopped short of its target: the pass was capped. */
function behind(progress?: FinalizedScanHealth) {
  return (
    progress?.scannedThrough != null &&
    progress.finalizedBlock != null &&
    BigInt(progress.scannedThrough) < BigInt(progress.finalizedBlock)
  );
}

/** A running keeper whose event scan has not advanced for this long is reported degraded. */
export function scanStaleAfterMs(pollIntervalMs: number) {
  return pollIntervalMs > 0 ? Math.max(3 * pollIntervalMs, 300_000) : 0;
}

export type KeeperHealthSnapshot = {
  schemaVersion: 1;
  status: KeeperHealthStatus;
  role: KeeperRole;
  chainId: number;
  gameHub: Address;
  vrfHub: Address;
  keeper: Address;
  startedAt: string;
  updatedAt: string;
  lastScannedBlock?: string;
  lastScanAt?: string;
  queueDepth: number;
  lastEnqueuedAt?: string;
  lastEnqueued?: {
    source: KeeperEvent["source"];
    betId: string;
    requestId?: string;
    blockNumber?: string;
    txHash?: Hex;
  };
  lastFinalizeSuccessAt?: string;
  lastFinalizeSuccess?: {
    betId: string;
    txHash: Hex;
    latencyMs: number;
  };
  lastFinalizeFailureAt?: string;
  lastFinalizeFailure?: {
    betId: string;
    reason: string;
    retryable: boolean;
  };
  lastError?: string;
  /**
   * Informational: the last latest-block read of the event scan was this many blocks below
   * `lastScannedBlock`. That pass scanned nothing; the stall check still applies.
   */
  scanHeadBehindBy?: string;
  pools?: PoolHealth[];
  lastPoolScanAt?: string;
  payables?: PayableHealth[];
  vaultProviderLedger?: FinalizedScanHealth;
  governance?: GovernanceHealth;
  voids?: VoidHealth;
  casinoRecoveryScannedThrough?: string;
  degradedBy?: Array<KeeperFailureSource | "stalled">;
  rpc?: {
    errorsLastMinute: Record<string, number>;
    lastMinute: Record<string, number>;
    total: Record<string, number>;
    totalErrors: Record<string, number>;
    windowStartedAt: string;
    updatedAt: string;
  };
};

// The web validates snapshots against the shared field lists; these fail to compile when they drift.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Holds<T extends true> = T;
export type KeeperHealthFieldsAreShared = Holds<
  Same<keyof KeeperHealthSnapshot, KeeperHealthSnapshotField>
>;
export type KeeperPoolFieldsAreShared = Holds<Same<keyof PoolHealth, KeeperPoolHealthField>>;
export type KeeperDegradedSourcesAreShared = Holds<
  Same<KeeperFailureSource | "stalled", KeeperDegradedSource>
>;

export type KeeperHealthSink = {
  write(snapshot: KeeperHealthSnapshot): void | Promise<void>;
};

export function createFileHealthSink(path: string): KeeperHealthSink {
  return {
    async write(snapshot) {
      await mkdir(dirname(path), { recursive: true });
      const tmpPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(tmpPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      await rename(tmpPath, path);
    }
  };
}

export class KeeperHealthReporter {
  private snapshotData: KeeperHealthSnapshot;

  constructor({
    config,
    keeper,
    sink,
    now = () => new Date()
  }: {
    config: KeeperConfig;
    keeper: Address;
    sink?: KeeperHealthSink;
    now?: () => Date;
  }) {
    this.sink = sink;
    this.now = now;
    this.scanStaleAfterMs = scanStaleAfterMs(config.pollIntervalMs);
    const startedAt = this.isoNow();
    this.scanProgressMs = Date.parse(startedAt);
    this.lifecycleProgressMs = Date.parse(startedAt);
    this.lifecycleEnabled =
      config.casinoRecoveryStartBlock != null || config.vaultProviderLedgerPools.length > 0;
    this.snapshotData = {
      schemaVersion: 1,
      status: "starting",
      role: config.role,
      chainId: config.chainId,
      gameHub: config.gameHub,
      vrfHub: config.vrfHub,
      keeper,
      startedAt,
      updatedAt: startedAt,
      lastScannedBlock: config.startBlock?.toString(),
      queueDepth: 0,
      voids: {
        gasLimit: config.voidGasLimit.toString(),
        candidates: [],
        candidateCount: 0,
        attempts: 0,
        voided: 0,
        settled: 0,
        failed: 0,
        startupRecoveryComplete: false
      }
    };
  }

  private readonly sink?: KeeperHealthSink;
  private readonly now: () => Date;
  private readonly scanStaleAfterMs: number;
  /** Open failures and their latest message, oldest first. */
  private readonly failures = new Map<KeeperFailureSource, string>();
  private readonly finalizeFailures = new Map<
    string,
    {
      at: string;
      detail: NonNullable<KeeperHealthSnapshot["lastFinalizeFailure"]>;
    }
  >();
  /** Open void failures by bet ID; `pass` and `configuration` cover the whole executor. */
  private readonly voidFailures = new Map<string, string>();
  /** Latest chain time (seconds) the void executor read; unbooked ages are measured against it. */
  private chainTime: bigint | undefined;
  private phase: "starting" | "running" | "stopped" = "starting";
  private scanProgressMs: number;
  private lifecycleProgressMs: number;
  private readonly lifecycleEnabled: boolean;

  snapshot() {
    return { ...this.snapshotData };
  }

  async recordStarted(lastScannedBlock: bigint, queueDepth: number) {
    this.phase = "starting";
    await this.update({
      lastScannedBlock: lastScannedBlock.toString(),
      queueDepth
    });
  }

  async recordRunning(lastScannedBlock: bigint, queueDepth: number) {
    if (this.phase === "starting" && this.snapshotData.lastScanAt === undefined) {
      // Scan progress is measured from here until the first scan lands.
      this.scanProgressMs = this.now().getTime();
    }
    this.phase = "running";
    await this.update({
      lastScannedBlock: lastScannedBlock.toString(),
      queueDepth
    });
  }

  /** Also where a stalled scan is noticed: the heartbeat keeps running when the scan loop hangs. */
  async recordHeartbeat(queueDepth: number, rpc?: KeeperHealthSnapshot["rpc"]) {
    await this.update({ queueDepth, rpc });
  }

  async recordEnqueued(event: KeeperEvent, queueDepth: number) {
    if (this.phase === "starting") this.phase = "running";
    await this.update({
      queueDepth,
      lastEnqueuedAt: this.isoNow(),
      lastEnqueued: {
        source: event.source,
        betId: event.betId.toString(),
        requestId: event.requestId?.toString(),
        blockNumber: event.blockNumber?.toString(),
        txHash: event.txHash
      }
    });
  }

  /** A scan chunk succeeded. Only a chunk that reaches the pass's target block clears a scan failure. */
  async recordScan(lastScannedBlock: bigint, targetBlock: bigint, queueDepth: number) {
    const at = this.now();
    this.scanProgressMs = at.getTime();
    if (lastScannedBlock >= targetBlock) this.failures.delete("scan");
    if (this.phase === "starting") this.phase = "running";
    await this.update({
      lastScannedBlock: lastScannedBlock.toString(),
      lastScanAt: at.toISOString(),
      queueDepth
    });
  }

  /**
   * A bank-provider ledger pass finished without error; a stalled finalized head, or a capped pass that stopped
   * short of it, still degrades it.
   */
  async recordLedgerScan(queueDepth: number, progress?: FinalizedScanHealth) {
    if (progress?.finalizedStalledSince)
      this.fail(
        "ledger",
        `Vault ledger finalized head ${progress.finalizedBlock} has not advanced since ${progress.finalizedStalledSince}`
      );
    else if (behind(progress))
      this.fail(
        "ledger",
        `Vault ledger scan incomplete through ${progress!.scannedThrough} (finalized target ${progress!.finalizedBlock})`
      );
    else if (!this.failures.delete("ledger") && progress === undefined) return;
    await this.update({
      queueDepth,
      ...(progress === undefined ? {} : { vaultProviderLedger: progress })
    });
  }

  /**
   * The event scan stopped at KEEPER_SCAN_MAX_CHUNKS_PER_PASS chunks short of the head. It degrades `scan` until a
   * pass reaches the head: a budget that cannot keep pace would otherwise fall behind for good while looking healthy.
   */
  async recordScanBehind(remainingBlocks: bigint, targetBlock: bigint, queueDepth: number) {
    this.fail(
      "scan",
      `event scan is ${remainingBlocks} blocks behind block ${targetBlock} after a capped pass`
    );
    await this.update({ queueDepth });
  }

  /** The event scan read a latest block below its cursor (informational), or no longer does. */
  async recordScanHeadBehind(behindBy: bigint | undefined, queueDepth: number) {
    const value = behindBy?.toString();
    if (value === this.snapshotData.scanHeadBehindBy) return;
    await this.update({ queueDepth, scanHeadBehindBy: value });
  }

  /**
   * A governance timelock pass finished without error; a stalled finalized head, or a capped pass that stopped
   * short of it, still degrades it.
   */
  async recordGovernanceScan(governance: GovernanceHealth, queueDepth: number) {
    if (governance.finalizedStalledSince)
      this.fail(
        "governance",
        `Governance timelock finalized head ${governance.finalizedBlock} has not advanced since ${governance.finalizedStalledSince}`
      );
    else if (!governance.caughtUp)
      this.fail(
        "governance",
        `Governance timelock indexing incomplete through ${governance.scannedThrough ?? "unknown"} (finalized target ${governance.finalizedBlock ?? "unknown"})`
      );
    else this.failures.delete("governance");
    await this.update({ governance, queueDepth });
  }

  /**
   * The void executor's current candidates, oldest VRF request first, measured against the latest
   * chain time the executor read. An unbooked result older than one hour degrades `unbookedResult`.
   */
  async recordVoidCandidates(
    candidates: VoidCandidateHealth[],
    queueDepth: number,
    chainTime?: bigint
  ) {
    if (chainTime != null && (this.chainTime == null || chainTime > this.chainTime))
      this.chainTime = chainTime;
    const oldest = candidates.reduce<VoidCandidateHealth | undefined>(
      (first, candidate) =>
        first == null || BigInt(candidate.receivedAt) < BigInt(first.receivedAt)
          ? candidate
          : first,
      undefined
    );
    const age =
      oldest && this.chainTime != null ? this.chainTime - BigInt(oldest.receivedAt) : undefined;
    if (oldest && age != null && age > UNBOOKED_RESULT_ALERT_SECONDS)
      this.fail(
        "unbookedResult",
        `bet ${oldest.betId}: result received ${age}s ago cannot be booked; voidBet allowed from ${oldest.eligibleAt}`
      );
    else this.failures.delete("unbookedResult");
    const voids: VoidHealth = {
      ...this.voidHealth(),
      candidates: candidates.slice(0, MAX_VOID_CANDIDATES_LISTED),
      candidateCount: candidates.length
    };
    if (oldest)
      voids.oldestUnbooked = {
        betId: oldest.betId,
        receivedAt: oldest.receivedAt,
        receivedFrom: oldest.receivedFrom,
        ageSeconds: (age ?? 0n).toString(),
        eligibleAt: oldest.eligibleAt
      };
    else delete voids.oldestUnbooked;
    await this.update({ queueDepth, voids });
  }

  /** Whether startup recovery is complete, so the void executor may act. */
  async recordVoidStartupRecovery(complete: boolean, queueDepth: number) {
    if (this.voidHealth().startupRecoveryComplete === complete) return;
    await this.update({
      queueDepth,
      voids: { ...this.voidHealth(), startupRecoveryComplete: complete }
    });
  }

  async recordVoidOutcome(betId: bigint, outcome: VoidAttemptOutcome, queueDepth: number) {
    const id = betId.toString();
    const voids = { ...this.voidHealth() };
    const last = (detail: Omit<NonNullable<VoidHealth["lastOutcome"]>, "betId">) => {
      voids.lastOutcomeAt = this.isoNow();
      voids.lastOutcome = { betId: id, ...detail };
    };
    switch (outcome.kind) {
      case "voided":
        voids.attempts += 1;
        voids.voided += 1;
        last({
          outcome: "voided",
          txHash: outcome.txHash,
          settlementErrorPrefix: outcome.settlementErrorPrefix
        });
        break;
      case "settled":
        voids.attempts += 1;
        voids.settled += 1;
        last({ outcome: "settled", txHash: outcome.txHash });
        break;
      case "failed":
        voids.attempts += 1;
        voids.failed += 1;
        last({
          outcome: "failed",
          reason: outcome.reason,
          ...(outcome.txHash ? { txHash: outcome.txHash } : {})
        });
        break;
      case "configurationError":
        voids.attempts += 1;
        voids.failed += 1;
        voids.configurationError = outcome.reason;
        last({ outcome: "configurationError", reason: outcome.reason });
        break;
      default:
        break;
    }
    if (outcome.kind === "voided" || outcome.kind === "settled") {
      delete voids.configurationError;
      this.voidFailures.delete("configuration");
    }
    if (outcome.kind === "failed") this.setVoidFailure(id, `bet ${id}: ${outcome.reason}`);
    else if (outcome.kind === "configurationError")
      this.setVoidFailure("configuration", outcome.reason);
    else if (outcome.kind !== "notEligible") this.voidFailures.delete(id);
    this.syncVoidFailure();
    await this.update({ queueDepth, voids });
  }

  /** A void pass could not read the chain; cleared by the next pass that does. */
  async recordVoidPass(error: string | undefined, queueDepth: number) {
    if (error === undefined && !this.voidFailures.has("pass")) return;
    if (error === undefined) this.voidFailures.delete("pass");
    else this.setVoidFailure("pass", error);
    this.syncVoidFailure();
    await this.update({ queueDepth });
  }

  /** A bet that left the void executor, settled or terminal, takes its failure with it. */
  async recordVoidCandidateClosed(betId: bigint, queueDepth: number) {
    if (!this.voidFailures.delete(betId.toString())) return;
    this.syncVoidFailure();
    await this.update({ queueDepth });
  }

  private voidHealth(): VoidHealth {
    return this.snapshotData.voids!;
  }

  private setVoidFailure(key: string, message: string) {
    this.voidFailures.delete(key);
    this.voidFailures.set(key, message);
  }

  private syncVoidFailure() {
    const latest = [...this.voidFailures.values()].at(-1);
    if (latest === undefined) this.failures.delete("void");
    else if (this.failures.get("void") !== latest) this.fail("void", latest);
  }

  async recordRecoveryScan(blockNumber: bigint, queueDepth: number, caughtUp = true) {
    if (caughtUp) this.failures.delete("recovery");
    else
      this.fail("recovery", `casino lifecycle recovery is incomplete through block ${blockNumber}`);
    await this.update({ casinoRecoveryScannedThrough: blockNumber.toString(), queueDepth });
  }

  async recordPools(pools: PoolHealth[], queueDepth: number) {
    this.lifecycleProgressMs = this.now().getTime();
    const errors = pools.filter((item) => item.error).map((item) => `${item.bank}: ${item.error}`);
    if (errors.length) this.fail("pools", errors.join("; "));
    else this.failures.delete("pools");
    await this.update({ pools, lastPoolScanAt: this.isoNow(), queueDepth });
  }

  async recordPayables(payables: PayableHealth[], queueDepth: number) {
    const failures = payables
      .filter(
        (item) =>
          !item.caughtUp ||
          item.readError ||
          item.claimError ||
          item.stateError ||
          item.finalizedStalledSince
      )
      .map(
        (item) =>
          `${item.bank}: ${
            item.readError ??
            item.claimError ??
            item.stateError ??
            (item.finalizedStalledSince
              ? `finalized head ${item.finalizedBlock} has not advanced since ${item.finalizedStalledSince}`
              : `payable discovery incomplete through ${item.scannedThrough ?? "unknown"} (finalized target ${item.finalizedBlock ?? "unknown"})`)
          }`
      );
    if (failures.length) this.fail("payables", failures.join("; "));
    else this.failures.delete("payables");
    await this.update({ payables, queueDepth });
  }

  async recordFinalizeOutcome(
    event: Pick<KeeperEvent, "betId">,
    outcome: FinalizeOutcome,
    queueDepth: number
  ) {
    if (this.phase === "starting") this.phase = "running";
    const betId = event.betId.toString();
    if (outcome.kind === "failed") {
      const failure = {
        at: this.isoNow(),
        detail: { betId, reason: outcome.reason, retryable: outcome.retryable }
      };
      this.finalizeFailures.delete(betId);
      this.finalizeFailures.set(betId, failure);
      this.fail("finalize", outcome.reason);
      await this.update({
        queueDepth,
        lastFinalizeFailureAt: failure.at,
        lastFinalizeFailure: failure.detail
      });
      return;
    }

    // A healthy read can defer PendingVRF work without leaving a recovered RPC error sticky.
    // Success for another bet cannot clear unresolved finalization failures.
    const reconciled =
      outcome.kind === "settled" || outcome.kind === "raced" || outcome.kind === "deferred";
    const recovered = reconciled && this.finalizeFailures.delete(betId);
    const latest = recovered ? [...this.finalizeFailures.values()].at(-1) : undefined;
    if (recovered) {
      if (latest) this.failures.set("finalize", latest.detail.reason);
      else this.failures.delete("finalize");
    }
    const failurePatch = recovered
      ? {
          lastFinalizeFailureAt: latest?.at,
          lastFinalizeFailure: latest?.detail
        }
      : {};
    if (outcome.kind === "settled") {
      await this.update({
        ...failurePatch,
        queueDepth,
        lastFinalizeSuccessAt: this.isoNow(),
        lastFinalizeSuccess: {
          betId,
          txHash: outcome.txHash,
          latencyMs: outcome.latencyMs
        }
      });
      return;
    }

    await this.update({ ...failurePatch, queueDepth });
  }

  /** Finalization and void failures are per bet and have their own recorders. */
  async recordError(
    message: string,
    queueDepth: number,
    source: Exclude<KeeperFailureSource, "finalize" | "void">
  ) {
    this.fail(source, message);
    await this.update({ queueDepth });
  }

  async recordStopped(queueDepth: number) {
    this.phase = "stopped";
    await this.update({ queueDepth });
  }

  private fail(source: KeeperFailureSource, message: string) {
    // Re-inserting keeps the newest failure last, so lastError names it.
    this.failures.delete(source);
    this.failures.set(source, message);
  }

  private async update(patch: Partial<KeeperHealthSnapshot>) {
    const at = this.now();
    const eventScanStalled =
      this.phase === "running" &&
      this.scanStaleAfterMs > 0 &&
      at.getTime() - this.scanProgressMs > this.scanStaleAfterMs;
    const lifecycleStalled =
      this.phase === "running" &&
      this.lifecycleEnabled &&
      at.getTime() - this.lifecycleProgressMs > 300_000;
    const stalled = eventScanStalled || lifecycleStalled;
    const degradedBy: Array<KeeperFailureSource | "stalled"> = [...this.failures.keys()];
    if (stalled) degradedBy.push("stalled");
    const messages = [...this.failures.values()];
    this.snapshotData = {
      ...this.snapshotData,
      ...patch,
      status:
        this.phase === "stopped" ? "stopped" : degradedBy.length > 0 ? "degraded" : this.phase,
      lastError:
        messages[messages.length - 1] ??
        (stalled
          ? lifecycleStalled
            ? `casino lifecycle reconciliation has not completed since ${new Date(this.lifecycleProgressMs).toISOString()}`
            : `event scan has not advanced since ${new Date(this.scanProgressMs).toISOString()}`
          : undefined),
      degradedBy: degradedBy.length > 0 ? degradedBy : undefined,
      updatedAt: at.toISOString()
    };
    if (!this.sink) return;
    await this.sink.write(this.snapshotData);
  }

  private isoNow() {
    return this.now().toISOString();
  }
}
