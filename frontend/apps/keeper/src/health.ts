import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Address, Hex } from "viem";

import type { FinalizeOutcome, KeeperConfig, KeeperEvent, KeeperRole } from "./types.js";

export type KeeperHealthStatus = "starting" | "running" | "degraded" | "stopped";

/**
 * Where a failure came from. Each one clears on the next success of the same path, so one
 * transient RPC error no longer holds the keeper degraded until the next bet settles.
 */
export type KeeperFailureSource =
  | "scan"
  | "ledger"
  | "finalize"
  | "recovery"
  | "redemption"
  | "pocket-recovery"
  | "payables"
  | "pocket";

export type RedemptionHealth = {
  bank: Address;
  batchId?: string;
  cutoff?: string;
  activationDue?: boolean;
  openHolds?: string;
  paused?: boolean;
  error?: string;
};

export type PocketHealth = {
  bank: Address;
  epochId: string;
  openedAt?: string;
  remainingHolds?: string;
  remainingReserve?: string;
  ageSeconds?: number;
  error?: string;
};

export type PocketDiscoveryHealth = {
  bank: Address;
  scannedThrough?: string;
  /** Pocket discovery and state reads cover finalized blocks only. */
  finalizedBlock?: string;
  headBlock?: string;
  caughtUp: boolean;
  error?: string;
};

/** Refused transfers remain owed; discovery and RPC failures require operational attention. */
export type PayableHealth = {
  bank: Address;
  scannedThrough?: string;
  /** Discovery covers finalized blocks only; recent debts wait for chain finality. */
  finalizedBlock?: string;
  headBlock?: string;
  caughtUp: boolean;
  pending: number;
  readError?: string;
  claimError?: string;
  error?: string;
};

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
  redemptions?: RedemptionHealth[];
  lastRedemptionScanAt?: string;
  pockets?: PocketHealth[];
  pocketDiscovery?: PocketDiscoveryHealth[];
  payables?: PayableHealth[];
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
      config.casinoRecoveryStartBlock != null || config.bankProviderLedgerPools.length > 0;
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
      queueDepth: 0
    };
  }

  private readonly sink?: KeeperHealthSink;
  private readonly now: () => Date;
  private readonly scanStaleAfterMs: number;
  /** Open failures and their latest message, oldest first. */
  private readonly failures = new Map<KeeperFailureSource, string>();
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

  async recordScan(lastScannedBlock: bigint, queueDepth: number) {
    const at = this.now();
    this.scanProgressMs = at.getTime();
    this.failures.delete("scan");
    if (this.phase === "starting") this.phase = "running";
    await this.update({
      lastScannedBlock: lastScannedBlock.toString(),
      lastScanAt: at.toISOString(),
      queueDepth
    });
  }

  /** A bank-provider ledger pass finished without error. */
  async recordLedgerScan(queueDepth: number) {
    if (!this.failures.delete("ledger")) return;
    await this.update({ queueDepth });
  }

  async recordRecoveryScan(blockNumber: bigint, queueDepth: number, caughtUp = true) {
    if (caughtUp) this.failures.delete("recovery");
    else
      this.fail("recovery", `casino lifecycle recovery is incomplete through block ${blockNumber}`);
    await this.update({ casinoRecoveryScannedThrough: blockNumber.toString(), queueDepth });
  }

  async recordRedemptions(redemptions: RedemptionHealth[], queueDepth: number) {
    this.lifecycleProgressMs = this.now().getTime();
    const errors = redemptions
      .filter((item) => item.error)
      .map((item) => `${item.bank}: ${item.error}`);
    if (errors.length) this.fail("redemption", errors.join("; "));
    else this.failures.delete("redemption");
    await this.update({ redemptions, lastRedemptionScanAt: this.isoNow(), queueDepth });
  }

  /** Receives the complete retained set, including epochs not polled on this pass. */
  async recordPockets(
    pockets: PocketHealth[],
    pocketDiscovery: PocketDiscoveryHealth[],
    queueDepth: number
  ) {
    const incomplete = pocketDiscovery.filter((item) => !item.caughtUp || item.error);
    if (incomplete.length)
      this.fail(
        "pocket-recovery",
        incomplete
          .map(
            (item) =>
              `${item.bank}: ${item.error ?? `pocket discovery is incomplete through block ${item.scannedThrough ?? "unknown"}`}`
          )
          .join("; ")
      );
    else this.failures.delete("pocket-recovery");
    const errors = pockets.flatMap((item) => {
      const messages: string[] = [];
      if (item.error) messages.push(`${item.bank} epoch ${item.epochId}: ${item.error}`);
      if (item.remainingHolds !== "0" && (item.ageSeconds ?? 0) > 600)
        messages.push(
          `${item.bank} epoch ${item.epochId} remains open beyond 10 minutes (opened at ${item.openedAt})`
        );
      return messages;
    });
    if (errors.length) this.fail("pocket", errors.join("; "));
    else this.failures.delete("pocket");
    await this.update({ pockets, pocketDiscovery, queueDepth });
  }

  async recordPayables(payables: PayableHealth[], queueDepth: number) {
    const failures = payables
      .filter((item) => !item.caughtUp || item.readError || item.claimError)
      .map(
        (item) =>
          `${item.bank}: ${item.readError ?? item.claimError ?? `payable discovery incomplete through ${item.scannedThrough ?? "unknown"} (finalized target ${item.finalizedBlock ?? "unknown"})`}`
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
    if (outcome.kind === "settled") {
      this.failures.delete("finalize");
      await this.update({
        queueDepth,
        lastFinalizeSuccessAt: this.isoNow(),
        lastFinalizeSuccess: {
          betId: event.betId.toString(),
          txHash: outcome.txHash,
          latencyMs: outcome.latencyMs
        }
      });
      return;
    }

    if (outcome.kind === "failed") {
      this.fail("finalize", outcome.reason);
      await this.update({
        queueDepth,
        lastFinalizeFailureAt: this.isoNow(),
        lastFinalizeFailure: {
          betId: event.betId.toString(),
          reason: outcome.reason,
          retryable: outcome.retryable
        }
      });
      return;
    }

    if (outcome.kind === "raced") {
      this.failures.delete("finalize");
      await this.update({
        queueDepth,
        lastFinalizeFailureAt: undefined,
        lastFinalizeFailure: undefined
      });
      return;
    }

    await this.update({ queueDepth });
  }

  async recordError(message: string, queueDepth: number, source: KeeperFailureSource) {
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
