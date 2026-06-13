import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { createFileHealthSink, KeeperHealthReporter, type KeeperHealthSnapshot } from "./health.js";
import type { KeeperConfig, KeeperEvent } from "./types.js";

const baseConfig: KeeperConfig = {
  chainId: 84532,
  gameHub: "0x1111111111111111111111111111111111111111",
  vrfHub: "0x2222222222222222222222222222222222222222",
  httpRpcUrl: "https://example.invalid",
  privateKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  role: "primary",
  backupDelayMs: 0,
  pollIntervalMs: 15_000,
  scanChunkBlocks: 10n,
  startBlock: 100n,
  betIndexSsl: false,
  betIndexWriteEnabled: false,
  bankProviderLedgerPools: [],
  bankProviderLedgerScanIntervalMs: 60_000,
  sportsTicketIndexEnabled: false,
  sportsTerminalizerEnabled: false,
  sportsTerminalizerScanChunkBlocks: 2_000n,
  sportsTerminalizerMarketIds: [],
  sportsTerminalizerMaxTicketsPerMarket: 200,
  sportsTicketEnumerationMax: 500,
  sportsTicketScanChunkBlocks: 2_000n,
  sportsTicketScanStartBlock: 100n
};

const keeper = "0x3333333333333333333333333333333333333333";

function reporter(snapshots: KeeperHealthSnapshot[] = []) {
  const dates = [
    new Date("2026-05-17T00:00:00.000Z"),
    new Date("2026-05-17T00:00:01.000Z"),
    new Date("2026-05-17T00:00:02.000Z"),
    new Date("2026-05-17T00:00:03.000Z"),
    new Date("2026-05-17T00:00:04.000Z")
  ];
  let index = 0;
  return new KeeperHealthReporter({
    config: baseConfig,
    keeper,
    sink: {
      write: (snapshot) => {
        snapshots.push(snapshot);
      }
    },
    now: () => dates[Math.min(index++, dates.length - 1)]!
  });
}

function event(overrides: Partial<KeeperEvent> = {}): KeeperEvent {
  return {
    source: "gameHub",
    betId: 14n,
    requestId: 99n,
    blockNumber: 123n,
    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    receivedAt: 1_000,
    ...overrides
  };
}

describe("KeeperHealthReporter", () => {
  it("records enqueue and successful finalize health", async () => {
    const snapshots: KeeperHealthSnapshot[] = [];
    const health = reporter(snapshots);

    await health.recordStarted(100n, 0);
    await health.recordEnqueued(event(), 1);
    await health.recordFinalizeOutcome(
      { betId: 14n },
      {
        kind: "settled",
        txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        latencyMs: 4200
      },
      0
    );

    expect(health.snapshot()).toMatchObject({
      status: "running",
      role: "primary",
      chainId: 84532,
      keeper,
      queueDepth: 0,
      lastScannedBlock: "100",
      lastEnqueued: {
        source: "gameHub",
        betId: "14",
        requestId: "99",
        blockNumber: "123"
      },
      lastFinalizeSuccess: {
        betId: "14",
        txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        latencyMs: 4200
      }
    });
    expect(snapshots).toHaveLength(3);
  });

  it("marks failed finalize attempts degraded", async () => {
    const health = reporter();

    await health.recordFinalizeOutcome(
      { betId: 15n },
      { kind: "failed", reason: "simulate reverted", retryable: true },
      1
    );

    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      queueDepth: 1,
      lastError: "simulate reverted",
      lastFinalizeFailure: {
        betId: "15",
        reason: "simulate reverted",
        retryable: true
      }
    });
  });

  it("clears stale finalize failures when another finalizer already settled the bet", async () => {
    const health = reporter();

    await health.recordFinalizeOutcome(
      { betId: 15n },
      { kind: "failed", reason: "finalize transaction reverted", retryable: true },
      1
    );
    await health.recordFinalizeOutcome({ betId: 15n }, { kind: "raced", state: "settled" }, 0);

    expect(health.snapshot()).toMatchObject({
      status: "running",
      queueDepth: 0,
      lastError: undefined,
      lastFinalizeFailureAt: undefined,
      lastFinalizeFailure: undefined
    });
  });

  it("writes atomically to a health file sink", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keeper-health-"));
    const path = join(dir, "casino-keeper-health.json");
    const health = new KeeperHealthReporter({
      config: baseConfig,
      keeper,
      sink: createFileHealthSink(path),
      now: () => new Date("2026-05-17T00:00:00.000Z")
    });

    await health.recordScan(120n, 0);

    const saved = JSON.parse(await readFile(path, "utf8")) as KeeperHealthSnapshot;
    expect(saved).toMatchObject({
      schemaVersion: 1,
      status: "running",
      lastScannedBlock: "120",
      queueDepth: 0
    });
  });

  it("allows overlapping file health writes without tmp rename collisions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keeper-health-"));
    const path = join(dir, "casino-keeper-health.json");
    const sink = createFileHealthSink(path);

    await Promise.all(
      [0, 1, 2, 3].map((queueDepth) =>
        sink.write({
          schemaVersion: 1,
          status: "running",
          role: "primary",
          chainId: 84532,
          gameHub: baseConfig.gameHub,
          vrfHub: baseConfig.vrfHub,
          keeper,
          startedAt: "2026-05-17T00:00:00.000Z",
          updatedAt: "2026-05-17T00:00:00.000Z",
          queueDepth
        })
      )
    );

    const saved = JSON.parse(await readFile(path, "utf8")) as KeeperHealthSnapshot;
    expect(saved.schemaVersion).toBe(1);
    expect(saved.status).toBe("running");
    expect(saved.queueDepth).toBeGreaterThanOrEqual(0);
  });

  it("includes RPC usage counters in heartbeat snapshots", async () => {
    const health = reporter();

    await health.recordHeartbeat(3, {
      errorsLastMinute: { getContractEvents: 1 },
      lastMinute: { getBlockNumber: 2, getContractEvents: 4 },
      total: { getBlockNumber: 12, getContractEvents: 20 },
      totalErrors: { getContractEvents: 1 },
      windowStartedAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:01.000Z"
    });

    expect(health.snapshot()).toMatchObject({
      queueDepth: 3,
      rpc: {
        errorsLastMinute: { getContractEvents: 1 },
        lastMinute: { getBlockNumber: 2, getContractEvents: 4 },
        total: { getBlockNumber: 12, getContractEvents: 20 },
        totalErrors: { getContractEvents: 1 },
        windowStartedAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:01.000Z"
      }
    });
  });
});
