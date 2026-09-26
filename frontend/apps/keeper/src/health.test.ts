import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import {
  createFileHealthSink,
  KeeperHealthReporter,
  scanStaleAfterMs,
  type KeeperHealthSnapshot
} from "./health.js";
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
  rpcMinIntervalMs: 0,
  scanChunkBlocks: 10n,
  scanMaxChunksPerPass: 50,
  sportsTicketScanMaxBlocks: 50_000n,
  scanIndexEventsEnabled: true,
  startBlock: 100n,
  startupScanEnabled: true,
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

function clockedReporter(pollIntervalMs = baseConfig.pollIntervalMs) {
  let nowMs = Date.parse("2026-09-26T00:00:00.000Z");
  const health = new KeeperHealthReporter({
    config: { ...baseConfig, pollIntervalMs },
    keeper,
    now: () => new Date(nowMs)
  });
  return {
    health,
    advance: (ms: number) => {
      nowMs += ms;
    }
  };
}

const settled = {
  kind: "settled",
  txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  latencyMs: 4200
} as const;

describe("KeeperHealthReporter failure recovery", () => {
  it("clears a scan error on the next successful scan", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordError("HTTP request failed. Status: 429", 0, "scan");
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["scan"],
      lastError: "HTTP request failed. Status: 429"
    });

    await health.recordScan(200n, 0);

    expect(health.snapshot()).toMatchObject({
      status: "running",
      degradedBy: undefined,
      lastError: undefined,
      lastScannedBlock: "200",
      lastScanAt: "2026-09-26T00:00:00.000Z"
    });
  });

  it("keeps each failure open until its own path succeeds", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordFinalizeOutcome(
      { betId: 15n },
      { kind: "failed", reason: "simulate reverted", retryable: false },
      1
    );
    await health.recordError("getLogs timed out", 1, "scan");
    await health.recordError("ledger read failed", 1, "ledger");
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["finalize", "scan", "ledger"],
      lastError: "ledger read failed"
    });

    await health.recordScan(200n, 1);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["finalize", "ledger"],
      lastError: "ledger read failed"
    });

    await health.recordLedgerScan(1);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["finalize"],
      lastError: "simulate reverted"
    });

    await health.recordFinalizeOutcome({ betId: 16n }, settled, 0);
    expect(health.snapshot()).toMatchObject({ status: "running", degradedBy: undefined });
  });

  it("does not let a settled bet hide a failing scan", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordError("getLogs timed out", 1, "scan");

    await health.recordFinalizeOutcome({ betId: 16n }, settled, 0);

    expect(health.snapshot()).toMatchObject({ status: "degraded", degradedBy: ["scan"] });
  });

  it("reports a scan that stops advancing while the heartbeat continues", async () => {
    const { health, advance } = clockedReporter();
    await health.recordRunning(100n, 0);

    advance(300_000);
    await health.recordHeartbeat(0);
    expect(health.snapshot().status).toBe("running");

    advance(1);
    await health.recordHeartbeat(0);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["stalled"],
      lastError: "event scan has not advanced since 2026-09-26T00:00:00.000Z"
    });

    await health.recordScan(150n, 0);
    advance(10_000);
    await health.recordHeartbeat(0);
    expect(health.snapshot()).toMatchObject({ status: "running", degradedBy: undefined });
  });

  it("does not report a stall while starting or with polling disabled", async () => {
    const starting = clockedReporter();
    await starting.health.recordStarted(100n, 0);
    starting.advance(3_600_000);
    await starting.health.recordHeartbeat(0);
    expect(starting.health.snapshot().status).toBe("starting");

    const unpolled = clockedReporter(0);
    await unpolled.health.recordRunning(100n, 0);
    unpolled.advance(3_600_000);
    await unpolled.health.recordHeartbeat(0);
    expect(unpolled.health.snapshot().status).toBe("running");
  });

  it("allows three poll intervals, and at least five minutes, before a scan counts as stalled", () => {
    expect(scanStaleAfterMs(300_000)).toBe(900_000);
    expect(scanStaleAfterMs(15_000)).toBe(300_000);
    expect(scanStaleAfterMs(0)).toBe(0);
  });

  it("reports stopped over open failures", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordError("getLogs timed out", 0, "scan");

    await health.recordStopped(0);

    expect(health.snapshot().status).toBe("stopped");
  });
});
