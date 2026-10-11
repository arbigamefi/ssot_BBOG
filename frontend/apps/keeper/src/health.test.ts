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
  scanIndexEventsEnabled: true,
  startBlock: 100n,
  startupScanEnabled: true,
  betIndexSsl: false,
  betIndexWriteEnabled: false,
  vaultProviderLedgerPools: [],
  vaultProviderLedgerScanIntervalMs: 60_000,
  voidGasLimit: 11_000_000n
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

    await health.recordFinalizeOutcome({ betId: 16n }, settled, 1);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["finalize"]
    });
    await health.recordFinalizeOutcome({ betId: 15n }, settled, 0);
    expect(health.snapshot()).toMatchObject({
      status: "running",
      degradedBy: undefined
    });
  });

  it.each(["settled", "raced"] as const)(
    "retains an earlier failed bet when the latest failed bet is %s",
    async (kind) => {
      const { health } = clockedReporter();
      await health.recordRunning(100n, 0);
      await health.recordFinalizeOutcome(
        { betId: 15n },
        { kind: "failed", reason: "A unavailable", retryable: true },
        1
      );
      await health.recordFinalizeOutcome(
        { betId: 16n },
        { kind: "failed", reason: "B unavailable", retryable: true },
        2
      );
      await health.recordFinalizeOutcome(
        { betId: 16n },
        kind === "settled" ? settled : { kind: "raced", state: "settled" },
        1
      );
      expect(health.snapshot()).toMatchObject({
        status: "degraded",
        queueDepth: 1,
        degradedBy: ["finalize"],
        lastError: "A unavailable",
        lastFinalizeFailure: {
          betId: "15",
          reason: "A unavailable",
          retryable: true
        }
      });
      await health.recordFinalizeOutcome({ betId: 15n }, { kind: "raced", state: "refunded" }, 0);
      expect(health.snapshot()).toMatchObject({
        status: "running",
        degradedBy: undefined,
        lastError: undefined,
        lastFinalizeFailure: undefined,
        lastFinalizeFailureAt: undefined
      });
    }
  );

  it.each(["none", "held"] as const)(
    "keeps a failed bet degraded after skipped %s",
    async (state) => {
      const { health } = clockedReporter();
      await health.recordFinalizeOutcome(
        { betId: 15n },
        { kind: "failed", reason: "A unavailable", retryable: true },
        1
      );
      await health.recordFinalizeOutcome({ betId: 15n }, { kind: "skipped", state }, 0);
      expect(health.snapshot()).toMatchObject({
        status: "degraded",
        degradedBy: ["finalize"],
        lastFinalizeFailure: { betId: "15", reason: "A unavailable" }
      });
    }
  );

  it("clears only the recovered bet when a retry is safely deferred", async () => {
    const { health } = clockedReporter();
    for (const betId of [15n, 16n])
      await health.recordFinalizeOutcome(
        { betId },
        { kind: "failed", reason: `bet ${betId} unavailable`, retryable: true },
        2
      );
    await health.recordFinalizeOutcome(
      { betId: 16n },
      { kind: "deferred", state: "pendingVrf", retryAfterMs: 60_000 },
      2
    );
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["finalize"],
      lastFinalizeFailure: { betId: "15", reason: "bet 15 unavailable" }
    });
  });

  it("does not clear another failure source when the failed bet recovers", async () => {
    const { health } = clockedReporter();
    await health.recordFinalizeOutcome(
      { betId: 15n },
      { kind: "failed", reason: "A unavailable", retryable: true },
      1
    );
    await health.recordError("scan unavailable", 1, "scan");
    await health.recordFinalizeOutcome({ betId: 15n }, settled, 0);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["scan"],
      lastError: "scan unavailable",
      lastFinalizeFailure: undefined
    });
    await health.recordScan(200n, 0);
    expect(health.snapshot().status).toBe("running");
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

describe("pool health", () => {
  it("keeps accounting failures across unrelated successful scans", async () => {
    const health = new KeeperHealthReporter({ config: baseConfig, keeper });
    const pool = { bank: baseConfig.gameHub, vault: baseConfig.gameHub };
    await health.recordRunning(100n, 0);
    await health.recordPools([{ ...pool, accountingValid: false, error: "Cash deficit" }], 0);
    await health.recordScan(101n, 0);
    await health.recordFinalizeOutcome({ betId: 5n }, { kind: "raced", state: "settled" }, 0);
    expect(health.snapshot().degradedBy).toEqual(["pools"]);
    await health.recordPools([{ ...pool, accountingValid: true }], 0);
    expect(health.snapshot().status).toBe("running");
  });
  it("clears only pool read errors and preserves recovery failures", async () => {
    const health = new KeeperHealthReporter({ config: baseConfig, keeper });
    const pool = { bank: baseConfig.gameHub, vault: baseConfig.gameHub };
    await health.recordRunning(100n, 0);
    await health.recordError("index unavailable", 0, "recovery");
    await health.recordPools([{ ...pool, error: "RPC unavailable" }], 0);
    expect(health.snapshot().degradedBy).toEqual(["recovery", "pools"]);
    await health.recordPools([pool], 0);
    expect(health.snapshot().degradedBy).toEqual(["recovery"]);
    await health.recordRecoveryScan(100n, 0, true);
    expect(health.snapshot().status).toBe("running");
  });
  it("alerts if lifecycle reconciliation hangs while the ordinary event scanner progresses", async () => {
    let timestamp = 0;
    const health = new KeeperHealthReporter({
      config: { ...baseConfig, casinoRecoveryStartBlock: 100n },
      keeper,
      now: () => new Date(timestamp)
    });
    await health.recordRunning(100n, 0);
    timestamp = 300_001;
    await health.recordScan(999n, 0);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["stalled"],
      lastError: expect.stringContaining("lifecycle")
    });
  });
});

describe("payable health", () => {
  it("separates incomplete discovery and read failures from expected refused payouts", async () => {
    const health = new KeeperHealthReporter({ config: baseConfig, keeper });
    const bank = baseConfig.gameHub;
    await health.recordRunning(100n, 0);
    await health.recordPayables([{ bank, caughtUp: false, pending: 0 }], 0);
    expect(health.snapshot().degradedBy).toContain("payables");
    await health.recordPayables([{ bank, caughtUp: true, pending: 1, error: "blacklisted" }], 0);
    expect(health.snapshot().status).toBe("running");
    await health.recordPayables([{ bank, caughtUp: true, pending: 1, readError: "RPC outage" }], 0);
    expect(health.snapshot().degradedBy).toContain("payables");
    await health.recordPayables(
      [{ bank, caughtUp: true, pending: 1, claimError: "send failed" }],
      0
    );
    await health.recordScan(101n, 0);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      lastError: expect.stringContaining("send failed")
    });
    await health.recordPayables([{ bank, caughtUp: true, pending: 0 }], 0);
    expect(health.snapshot().status).toBe("running");
  });
});

describe("finalized head stalls", () => {
  it("degrades the ledger, governance and payables while their finalized head has not advanced", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    const since = "2026-09-25T23:00:00.000Z";
    await health.recordLedgerScan(0, {
      scannedThrough: "90",
      finalizedBlock: "90",
      finalizedStalledSince: since
    });
    await health.recordGovernanceScan(
      {
        timelock: "0x4444444444444444444444444444444444444444",
        scannedThrough: "90",
        finalizedBlock: "90",
        finalizedStalledSince: since,
        caughtUp: true
      },
      0
    );
    await health.recordPayables(
      [
        {
          bank: baseConfig.gameHub,
          caughtUp: true,
          pending: 0,
          finalizedBlock: "90",
          finalizedStalledSince: since
        }
      ],
      0
    );
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["ledger", "governance", "payables"],
      lastError: `${baseConfig.gameHub}: finalized head 90 has not advanced since ${since}`
    });
    await health.recordLedgerScan(0, { scannedThrough: "95", finalizedBlock: "95" });
    await health.recordGovernanceScan(
      {
        timelock: "0x4444444444444444444444444444444444444444",
        scannedThrough: "95",
        finalizedBlock: "95",
        caughtUp: true
      },
      0
    );
    await health.recordPayables([{ bank: baseConfig.gameHub, caughtUp: true, pending: 0 }], 0);
    expect(health.snapshot()).toMatchObject({ status: "running", degradedBy: undefined });
  });
});

describe("finalized-head and governance progress", () => {
  it("publishes a lagging finalized read as information, not a failure", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordLedgerScan(0, {
      scannedThrough: "47969422",
      finalizedBlock: "47969244",
      finalizedBehindBy: "178"
    });
    expect(health.snapshot()).toMatchObject({
      status: "running",
      degradedBy: undefined,
      vaultProviderLedger: { finalizedBehindBy: "178" }
    });
  });

  it("keeps the event-scan stall check while the latest read lags behind the cursor", async () => {
    const { health, advance } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordScanHeadBehind(3n, 0);
    expect(health.snapshot()).toMatchObject({ status: "running", scanHeadBehindBy: "3" });
    advance(300_001);
    await health.recordHeartbeat(0);
    expect(health.snapshot()).toMatchObject({ status: "degraded", degradedBy: ["stalled"] });
    await health.recordScan(101n, 0);
    await health.recordScanHeadBehind(undefined, 0);
    expect(health.snapshot()).toMatchObject({ status: "running", scanHeadBehindBy: undefined });
  });

  it("degrades on a governance indexing failure until the next successful pass", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordError("Governance timelock indexing refused: …", 0, "governance");
    expect(health.snapshot()).toMatchObject({ status: "degraded", degradedBy: ["governance"] });
    const timelock = "0x4444444444444444444444444444444444444444" as const;
    await health.recordGovernanceScan(
      { timelock, scannedThrough: "200", finalizedBlock: "200", caughtUp: true },
      0
    );
    expect(health.snapshot()).toMatchObject({
      status: "running",
      governance: { timelock, scannedThrough: "200", caughtUp: true }
    });
  });
});

describe("void executor health", () => {
  const txHash = `0x${"dd".repeat(32)}` as const;
  const prefix = `0x${"ab".repeat(32)}` as const;

  it("starts with the configured gas limit, no outcomes and startup recovery pending", async () => {
    const { health } = clockedReporter();
    expect(health.snapshot().voids).toEqual({
      gasLimit: "11000000",
      candidates: [],
      candidateCount: 0,
      attempts: 0,
      voided: 0,
      settled: 0,
      failed: 0,
      startupRecoveryComplete: false
    });
    await health.recordVoidStartupRecovery(true, 0);
    expect(health.snapshot().voids?.startupRecoveryComplete).toBe(true);
  });

  it("degrades unbookedResult once the oldest unbooked result is older than one hour", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    const candidate = (betId: string, receivedAt: string) => ({
      betId,
      bank: baseConfig.gameHub,
      vrfRequestedAt: receivedAt,
      receivedAt,
      receivedFrom: "result" as const,
      eligibleAt: String(BigInt(receivedAt) + 604_800n),
      eligible: false,
      reason: "SafeERC20FailedOperation(…)"
    });
    const candidates = [candidate("8", "2000"), candidate("7", "1000")];
    await health.recordVoidCandidates(candidates, 0, 4_600n);
    expect(health.snapshot()).toMatchObject({
      status: "running",
      voids: {
        oldestUnbooked: {
          betId: "7",
          receivedAt: "1000",
          receivedFrom: "result",
          ageSeconds: "3600",
          eligibleAt: "605800"
        }
      }
    });
    await health.recordVoidCandidates(candidates, 0, 4_601n);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["unbookedResult"],
      lastError: "bet 7: result received 3601s ago cannot be booked; voidBet allowed from 605800",
      voids: { oldestUnbooked: { betId: "7", ageSeconds: "3601" } }
    });
    // Without a new chain-time read the last one is used; voiding the old result clears the alert.
    await health.recordVoidCandidates([candidates[0]!], 0);
    expect(health.snapshot()).toMatchObject({
      status: "running",
      voids: { oldestUnbooked: { betId: "8", ageSeconds: "2601" } }
    });
    await health.recordVoidCandidates([], 0);
    expect(health.snapshot().voids?.oldestUnbooked).toBeUndefined();
  });

  it("counts outcomes and keeps the last one with its transaction", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordVoidOutcome(
      7n,
      { kind: "voided", txHash, stake: 5n, settlementErrorPrefix: prefix, latencyMs: 10 },
      0
    );
    await health.recordVoidOutcome(8n, { kind: "settled", txHash, latencyMs: 10 }, 0);
    await health.recordVoidOutcome(9n, { kind: "raced", state: "voided" }, 0);
    expect(health.snapshot()).toMatchObject({
      status: "running",
      voids: {
        attempts: 2,
        voided: 1,
        settled: 1,
        failed: 0,
        lastOutcome: { betId: "8", outcome: "settled", txHash },
        lastOutcomeAt: "2026-09-26T00:00:00.000Z"
      }
    });
  });

  it("degrades on a failed attempt until that bet is resolved, whatever other bets do", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    await health.recordVoidOutcome(7n, { kind: "failed", reason: "voidBet reverted", txHash }, 0);
    await health.recordVoidOutcome(
      8n,
      { kind: "voided", txHash, stake: 5n, settlementErrorPrefix: prefix, latencyMs: 1 },
      0
    );
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["void"],
      lastError: "bet 7: voidBet reverted",
      voids: { attempts: 2, failed: 1, voided: 1 }
    });
    await health.recordVoidOutcome(7n, { kind: "notEligible", eligibleAt: 10n }, 0);
    expect(health.snapshot().status).toBe("degraded");
    await health.recordVoidOutcome(7n, { kind: "raced", state: "settled" }, 0);
    expect(health.snapshot()).toMatchObject({ status: "running", degradedBy: undefined });
  });

  it("holds a configuration error until a void transaction succeeds", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    const reason = "voidBet needs more gas than KEEPER_VOID_GAS_LIMIT=11000000";
    await health.recordVoidOutcome(7n, { kind: "configurationError", reason }, 0);
    await health.recordVoidOutcome(7n, { kind: "raced", state: "voided" }, 0);
    expect(health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["void"],
      voids: { configurationError: reason, lastOutcome: { outcome: "configurationError" } }
    });
    await health.recordVoidOutcome(8n, { kind: "settled", txHash, latencyMs: 1 }, 0);
    expect(health.snapshot().status).toBe("running");
    expect(health.snapshot().voids?.configurationError).toBeUndefined();
  });

  it("lists candidates and a void pass that cannot read the chain", async () => {
    const { health } = clockedReporter();
    await health.recordRunning(100n, 0);
    const candidate = {
      betId: "7",
      bank: baseConfig.gameHub,
      vrfRequestedAt: "1000",
      receivedAt: "1004",
      receivedFrom: "result" as const,
      eligibleAt: "87400",
      eligible: false,
      reason: "SafeERC20FailedOperation(…)"
    };
    await health.recordVoidCandidates(
      Array.from({ length: 60 }, (_, i) => ({ ...candidate, betId: String(i) })),
      0
    );
    expect(health.snapshot().voids).toMatchObject({ candidateCount: 60 });
    expect(health.snapshot().voids?.candidates).toHaveLength(50);
    await health.recordVoidPass("HttpRequestError [status=429]", 0);
    expect(health.snapshot()).toMatchObject({ status: "degraded", degradedBy: ["void"] });
    await health.recordVoidPass(undefined, 0);
    expect(health.snapshot().status).toBe("running");
  });
});
