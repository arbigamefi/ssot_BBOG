import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Address, Hex } from "viem";

import type { FinalizeOutcome, KeeperConfig, KeeperEvent, KeeperRole } from "./types.js";

export type KeeperHealthStatus = "starting" | "running" | "degraded" | "stopped";

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
    const startedAt = this.isoNow();
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

  snapshot() {
    return { ...this.snapshotData };
  }

  async recordStarted(lastScannedBlock: bigint, queueDepth: number) {
    await this.update({
      status: "starting",
      lastScannedBlock: lastScannedBlock.toString(),
      queueDepth
    });
  }

  async recordRunning(lastScannedBlock: bigint, queueDepth: number) {
    await this.update({
      status: this.snapshotData.status === "degraded" ? "degraded" : "running",
      lastScannedBlock: lastScannedBlock.toString(),
      queueDepth
    });
  }

  async recordHeartbeat(queueDepth: number) {
    await this.update({ queueDepth });
  }

  async recordEnqueued(event: KeeperEvent, queueDepth: number) {
    await this.update({
      status: this.snapshotData.status === "starting" ? "running" : this.snapshotData.status,
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
    await this.update({
      status: this.snapshotData.status === "degraded" ? "degraded" : "running",
      lastScannedBlock: lastScannedBlock.toString(),
      queueDepth
    });
  }

  async recordFinalizeOutcome(
    event: Pick<KeeperEvent, "betId">,
    outcome: FinalizeOutcome,
    queueDepth: number
  ) {
    if (outcome.kind === "settled") {
      await this.update({
        status: "running",
        queueDepth,
        lastError: undefined,
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
      await this.update({
        status: "degraded",
        queueDepth,
        lastError: outcome.reason,
        lastFinalizeFailureAt: this.isoNow(),
        lastFinalizeFailure: {
          betId: event.betId.toString(),
          reason: outcome.reason,
          retryable: outcome.retryable
        }
      });
      return;
    }

    await this.update({
      status: this.snapshotData.status === "degraded" ? "degraded" : "running",
      queueDepth
    });
  }

  async recordError(message: string, queueDepth: number) {
    await this.update({
      status: "degraded",
      queueDepth,
      lastError: message
    });
  }

  async recordStopped(queueDepth: number) {
    await this.update({
      status: "stopped",
      queueDepth
    });
  }

  private async update(patch: Partial<KeeperHealthSnapshot>) {
    this.snapshotData = {
      ...this.snapshotData,
      ...patch,
      updatedAt: this.isoNow()
    };
    if (!this.sink) return;
    await this.sink.write(this.snapshotData);
  }

  private isoNow() {
    return this.now().toISOString();
  }
}
