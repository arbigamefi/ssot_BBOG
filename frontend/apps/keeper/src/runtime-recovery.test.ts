import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryBetIndexStore, type BetIndexStore } from "@ssot/bet-index";
import { createKeeperRuntime, type KeeperRuntime } from "./runtime.js";
import type { KeeperConfig } from "./types.js";

const mock = vi.hoisted(() => ({
  client: {} as Record<string, unknown>,
  store: undefined as BetIndexStore | undefined
}));
vi.mock("viem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem")>()),
  createPublicClient: vi.fn(() => mock.client),
  createWalletClient: vi.fn(() => mock.client)
}));
vi.mock("@ssot/bet-index", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ssot/bet-index")>()),
  createPostgresBetIndexStore: vi.fn(() => mock.store)
}));

const hub = "0x0000000000000000000000000000000000000001" as const;
const hash = `0x${"aa".repeat(32)}` as const;
const base: KeeperConfig = {
  chainId: 8453,
  gameHub: hub,
  sportsHub: hub,
  vrfHub: hub,
  httpRpcUrl: "http://unused.invalid",
  privateKey: `0x${"11".repeat(32)}`,
  role: "primary",
  backupDelayMs: 0,
  pollIntervalMs: 300_000,
  rpcMinIntervalMs: 0,
  scanChunkBlocks: 10n,
  scanMaxChunksPerPass: 2,
  scanIndexEventsEnabled: true,
  startupScanEnabled: true,
  startBlock: 100n,
  betIndexWriteEnabled: true,
  betIndexDatabaseUrl: "postgres://unused.invalid",
  betIndexSsl: false,
  bankProviderLedgerPools: [],
  bankProviderLedgerScanIntervalMs: 0,
  sportsTicketIndexEnabled: false,
  sportsTerminalizerEnabled: false,
  sportsTerminalizerMarketIds: [],
  sportsTerminalizerScanChunkBlocks: 10n,
  sportsTerminalizerMaxTicketsPerMarket: 2,
  sportsTicketEnumerationMax: 500,
  sportsTicketScanChunkBlocks: 10n,
  sportsTicketScanMaxBlocks: 50_000n,
  sportsTicketScanStartBlock: 100n
};

describe("runtime recovery composition", () => {
  let runtime: KeeperRuntime | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    mock.store = createMemoryBetIndexStore();
    mock.client = {
      getBlockNumber: vi.fn(async () => 120n),
      getBlock: vi.fn(async () => ({ timestamp: 1000n })),
      getContractEvents: vi.fn(
        async ({ eventName, fromBlock }: { eventName: string; fromBlock: bigint }) => {
          if (fromBlock !== 101n || !["BetRandomReady", "BetPlaced"].includes(eventName)) return [];
          return [
            {
              args: { betId: 1n, requestId: 1n },
              blockNumber: 105n,
              transactionHash: hash,
              logIndex: 0
            }
          ];
        }
      ),
      readContract: vi.fn(async () => ({ betId: 1n, requestId: 1n, state: 4 })),
      writeContract: vi.fn(),
      simulateContract: vi.fn()
    };
  });
  afterEach(async () => {
    await runtime?.stop();
    runtime = undefined;
    vi.useRealTimers();
  });
  const make = (config: KeeperConfig = base) =>
    createKeeperRuntime({ config, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });

  it("retries missing terminal refunds without checkpointing an incomplete range", async () => {
    const amounts = {
      payoutGross: 200_000n,
      payoutNet: 196_000n,
      feeOnPayout: 4_000n,
      protocolFeeAccrual: 2_000n
    };
    vi.mocked(mock.client.getContractEvents as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ eventName, fromBlock }) =>
        eventName === "BetFinalized" && fromBlock === 101n
          ? [
              {
                args: { positionId: 9n, ...amounts },
                blockNumber: 105n,
                transactionHash: hash,
                logIndex: 1
              }
            ]
          : []
    );
    const terminalRead = vi
      .fn()
      .mockRejectedValueOnce(new Error("terminal RPC unavailable"))
      .mockResolvedValue({ state: 4, ...amounts, refundAmount: 100_000n });
    mock.client.readContract = terminalRead;
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBeNull();
    expect(await mock.store!.getBet({ chainId: 8453, betId: 9 })).toBeNull();
    expect(runtime.health.snapshot().status).toBe("degraded");
    await vi.advanceTimersByTimeAsync(300_000);
    expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBe(120n);
    expect(await mock.store!.getBet({ chainId: 8453, betId: 9 })).toMatchObject({
      payout: "196000",
      refundAmount: "100000",
      state: "finalized"
    });
    expect(mock.client.writeContract).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "retries a failed index range without advancing the cursor (full scan=%s)",
    async (fullScan) => {
      const write = vi
        .spyOn(mock.store!, "writeGameHubEvents")
        .mockRejectedValueOnce(new Error("deadlock detected"));
      runtime = make({ ...base, scanIndexEventsEnabled: fullScan });
      await runtime.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBeNull();
      // Index failure must not prevent the already discovered casino bet being queued.
      expect(runtime.queue.has(1n)).toBe(true);
      expect(runtime.health.snapshot().status).toBe("degraded");
      await vi.advanceTimersByTimeAsync(300_000);
      expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBe(120n);
      const calls = vi.mocked(mock.client.getContractEvents as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        calls.filter(([q]) => q.eventName === "BetRandomReady").map(([q]) => q.fromBlock)
      ).toEqual(fullScan ? [101n, 101n, 101n, 111n, 111n] : [101n, 101n, 111n]);
      expect(write).toHaveBeenCalled();
    }
  );

  it("rejects sports without durable storage before any transaction or timer starts", () => {
    expect(() =>
      make({ ...base, sportsTerminalizerEnabled: true, betIndexWriteEnabled: false })
    ).toThrow(/BET_INDEX_WRITE_ENABLED=true/);
    expect(mock.client.writeContract).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an undeployed zero SportsHub only when sports is enabled", () => {
    const zero = "0x0000000000000000000000000000000000000000" as const;
    expect(() => make({ ...base, sportsHub: zero, sportsTerminalizerEnabled: true })).toThrow(
      /sportsHub/
    );
    expect(() => make({ ...base, sportsHub: zero })).not.toThrow();
    expect(mock.client.writeContract).not.toHaveBeenCalled();
  });

  it("rehydrates a casino bet after a checkpoint-before-drain restart", async () => {
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBe(120n);
    expect(runtime.queue.has(1n)).toBe(true);
    await runtime.stop();
    vi.mocked(mock.client.getContractEvents as ReturnType<typeof vi.fn>).mockClear();
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(mock.client.getContractEvents).not.toHaveBeenCalled();
  });

  it.each([300_000, 0])(
    "rotates a bounded casino recovery page past a poisoned prefix (poll=%s)",
    async (pollIntervalMs) => {
      vi.mocked(mock.client.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValue(100n);
      vi.mocked(mock.client.readContract as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("bad bet RPC response")
      );
      await mock.store!.writeGameHubEvents(
        Array.from({ length: 52 }, (_, i) => ({
          chainId: 8453,
          gameHub: hub,
          eventName: "BetRandomReady" as const,
          blockNumber: 100n,
          logIndex: i,
          txHash: `0x${String(i + 1).padStart(64, "0")}` as const,
          args: { betId: BigInt(i + 1), requestId: BigInt(i + 1) }
        }))
      );
      runtime = make({ ...base, startupScanEnabled: false, pollIntervalMs });
      await runtime.start();
      expect(runtime.queue.size).toBe(50);
      expect(runtime.queue.has(51n)).toBe(false);
      await vi.advanceTimersByTimeAsync(300_000);
      expect(runtime.queue.has(51n)).toBe(true);
      expect(runtime.queue.has(52n)).toBe(true);
    }
  );

  it("rejects a sports database migration failure before starting workers", async () => {
    vi.spyOn(mock.store!, "migrate").mockRejectedValueOnce(new Error("database unavailable"));
    runtime = make({ ...base, sportsTerminalizerEnabled: true });
    await expect(runtime.start()).rejects.toThrow("database unavailable");
    expect(mock.client.writeContract).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an open manual recovery market before any watcher, timer or transaction", async () => {
    vi.mocked(mock.client.readContract as ReturnType<typeof vi.fn>).mockResolvedValue({
      marketId: 7n,
      state: 2
    });
    mock.client.watchContractEvent = vi.fn();
    runtime = make({
      ...base,
      sportsTerminalizerEnabled: true,
      sportsTerminalizerMarketIds: [7n],
      wsRpcUrl: "ws://unused.invalid"
    });
    await expect(runtime.start()).rejects.toThrow(/still accepts tickets/);
    expect(mock.client.writeContract).not.toHaveBeenCalled();
    expect(mock.client.watchContractEvent).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves casino recovery with sports disabled and no database", async () => {
    runtime = make({ ...base, betIndexWriteEnabled: false, betIndexDatabaseUrl: undefined });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(runtime.health.snapshot().lastScannedBlock).toBe("120");
    const calls = vi.mocked(mock.client.getContractEvents as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.every(([q]) => q.eventName === "BetRandomReady")).toBe(true);
  });
});
