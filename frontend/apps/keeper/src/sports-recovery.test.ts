import { describe, expect, it, vi } from "vitest";
import { createMemoryBetIndexStore } from "@ssot/bet-index";
import type { PublicClient } from "viem";
import type { KeeperConfig, KeeperLogger } from "./types.js";
import { createSportsRecovery, sportsCursorSources } from "./sports-recovery.js";

const hub = "0x0000000000000000000000000000000000000001" as const;
const scope = { chainId: 8453, sportsHub: hub };
const hash = `0x${"aa".repeat(32)}` as const;
const config: KeeperConfig = {
  ...scope,
  sportsTerminalizerEnabled: true,
  sportsTicketIndexEnabled: false,
  gameHub: hub,
  vrfHub: hub,
  httpRpcUrl: "http://unused.invalid",
  privateKey: `0x${"11".repeat(32)}`,
  rpcMinIntervalMs: 0,
  scanChunkBlocks: 10n,
  scanIndexEventsEnabled: false,
  startBlock: 100n,
  betIndexWriteEnabled: true,
  betIndexDatabaseUrl: "postgres://unused.invalid",
  betIndexSsl: false,
  bankProviderLedgerPools: [],
  bankProviderLedgerScanIntervalMs: 0,
  sportsTicketEnumerationMax: 500,
  sportsTerminalizerMarketIds: [],
  sportsTicketScanStartBlock: 100n,
  sportsTerminalizerScanChunkBlocks: 10n,
  sportsTicketScanChunkBlocks: 10n,
  sportsTicketScanMaxBlocks: 50_000n,
  scanMaxChunksPerPass: 1,
  sportsTerminalizerMaxTicketsPerMarket: 2,
  pollIntervalMs: 300_000,
  role: "primary",
  backupDelayMs: 0,
  startupScanEnabled: false
};
const sources = sportsCursorSources(100n);

function fixture(overrides: Partial<KeeperConfig> = {}) {
  const store = createMemoryBetIndexStore();
  let now = 1_000_000;
  let head = 129n;
  const held = new Set([1n, 2n, 3n]);
  const ticketLogs = [1n, 2n, 3n].map((ticketId, i) => ({
    args: { ticketId, marketId: 7n },
    blockNumber: 100n + BigInt(i),
    transactionHash: hash,
    logIndex: i
  }));
  const marketLogs = [
    { args: { marketId: 7n }, blockNumber: 120n, transactionHash: hash, logIndex: 0 }
  ];
  const events = vi.fn(
    async ({
      eventName,
      fromBlock,
      toBlock
    }: {
      eventName: string;
      fromBlock: bigint;
      toBlock: bigint;
    }) => {
      const logs =
        eventName === "TicketPlaced"
          ? ticketLogs
          : eventName === "ResultFinalized"
            ? marketLogs
            : [];
      return logs.filter((log) => log.blockNumber >= fromBlock && log.blockNumber <= toBlock);
    }
  );
  const client = {
    getBlockNumber: vi.fn(async () => head),
    getContractEvents: events
  } as unknown as PublicClient;
  const writeSettleTicket = vi.fn(async (id: bigint) => {
    held.delete(id);
    return hash;
  });
  const deps = {
    readMarket: vi.fn(async () => ({ marketId: 7n, state: "resolved" as const })),
    readResult: vi.fn(async () => ({ marketId: 7n, challenged: false, finalizesAt: 0 })),
    readTicket: vi.fn(async (ticketId: bigint) => ({
      ticketId,
      state: held.has(ticketId) ? ("held" as const) : ("settled" as const)
    })),
    simulateFinalizeResult: vi.fn(async () => {}),
    simulateRefundTicket: vi.fn(async () => {}),
    simulateSettleTicket: vi.fn(async () => {}),
    writeFinalizeResult: vi.fn(async () => hash),
    writeRefundTicket: vi.fn(async () => hash),
    writeSettleTicket,
    waitReceipt: vi.fn(async () => ({ status: "success" as const }))
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies KeeperLogger;
  const make = () =>
    createSportsRecovery({
      config: { ...config, ...overrides },
      store,
      publicClient: client,
      deps,
      logger,
      now: () => now
    });
  return {
    store,
    events,
    deps,
    held,
    logger,
    make,
    setHead: (value: bigint) => {
      head = value;
    },
    advance: (ms = 300_000) => {
      now += ms;
    },
    now: () => now,
    pending: () => store.sportsRecovery.due(scope, Number.MAX_SAFE_INTEGER, 20)
  };
}

describe("durable sports recovery", () => {
  it("resumes both bounded cursors across restarts independently of a casino cursor", async () => {
    const f = fixture();
    await f.store.setCursor({
      chainId: scope.chainId,
      cursorKey: hub,
      source: "gamehub-events",
      blockNumber: 99_999n
    });
    let recovery = f.make();
    await recovery.scan();
    expect(await f.store.getCursor(scope.chainId, sources.markets, hub)).toBe(109n);
    expect(await f.store.getCursor(scope.chainId, sources.tickets, hub)).toBe(109n);
    await recovery.stop();
    recovery = f.make();
    await recovery.scan();
    await recovery.scan();
    expect(await f.store.getCursor(scope.chainId, sources.markets, hub)).toBe(129n);
    expect(await f.pending()).toHaveLength(1);
    expect(
      f.events.mock.calls.filter(([q]) => q.eventName === "TicketPlaced").map(([q]) => q.fromBlock)
    ).toEqual([100n, 110n, 120n]);
  });

  it("retains work before advancing the event cursor and replays a crash between them", async () => {
    const f = fixture({ scanMaxChunksPerPass: 3 });
    const setCursor = f.store.setCursor;
    let fail = true;
    f.store.setCursor = async (cursor) => {
      if (cursor.source === sources.markets && cursor.blockNumber === 129n && fail) {
        fail = false;
        throw new Error("crash after durable enqueue");
      }
      return setCursor(cursor);
    };
    const r = f.make();
    await expect(r.scan()).rejects.toThrow("crash after durable enqueue");
    expect(await f.pending()).toHaveLength(1);
    expect(await f.store.getCursor(scope.chainId, sources.markets, hub)).toBe(119n);
    await r.stop();
    const restarted = f.make();
    await restarted.scan();
    await restarted.runDue();
    await restarted.runDue();
    expect(f.held.size).toBe(0);
    expect(await f.pending()).toHaveLength(0);
  });

  it("does not checkpoint a market range when shutdown skips an in-flight enqueue", async () => {
    const f = fixture();
    f.setHead(109n);
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    f.events.mockImplementation(async (q) => {
      if (q.eventName !== "ResultFinalized") return [];
      if (first) {
        first = false;
        entered();
        await gate;
      }
      return [{ args: { marketId: 7n }, blockNumber: 105n, transactionHash: hash, logIndex: 0 }];
    });
    const r = f.make();
    const scan = r.scan();
    await blocked;
    const stopping = r.stop();
    release();
    await Promise.all([scan, stopping]);
    expect(await f.store.getCursor(scope.chainId, sources.markets, hub)).toBeNull();
    const restarted = f.make();
    await restarted.scan();
    expect(await f.store.getCursor(scope.chainId, sources.markets, hub)).toBe(109n);
    expect((await f.pending())[0]?.marketId).toBe(7n);
  });

  it("keeps old-ticket work after eight retries and completes after bounded history catches up", async () => {
    const f = fixture({ sportsTicketScanMaxBlocks: 10n, scanMaxChunksPerPass: 3 });
    f.setHead(50_101n);
    const r = f.make();
    await r.enqueue(7n, 50_101n);
    for (let i = 0; i < 10; i++) {
      await r.runDue();
      f.advance();
    }
    expect(await f.pending()).toHaveLength(1);
    expect(f.deps.writeSettleTicket).not.toHaveBeenCalled();
    await r.scan();
    await r.scan();
    expect(
      f.events.mock.calls
        .filter(([q]) => q.eventName === "TicketPlaced")
        .map(([q]) => [q.fromBlock, q.toBlock])
    ).toEqual([
      [100n, 109n],
      [110n, 119n]
    ]);
    // Complete the remaining deterministic history; no administrative cursor advance.
    for (let i = 0; i < 4_999; i++) await r.scan();
    await r.runDue();
    await r.runDue();
    expect(f.held.size).toBe(0);
    expect(await f.pending()).toHaveLength(0);
  });

  it("drains every page, including an already terminal prefix, without using a partial shared index", async () => {
    const f = fixture({ scanMaxChunksPerPass: 3 });
    f.held.delete(1n);
    const sharedIndex = vi.spyOn(f.store, "getHeldSportsTicketIdsByMarket").mockResolvedValue([1n]);
    const r = f.make();
    await r.scan();
    await r.runDue();
    expect((await f.pending())[0]?.ticketCursor).toBe(2n);
    expect(f.held.has(3n)).toBe(true);
    await r.runDue();
    expect(f.deps.writeSettleTicket.mock.calls.map(([id]) => id)).toEqual([2n, 3n]);
    expect(await f.pending()).toHaveLength(0);
    expect(sharedIndex).not.toHaveBeenCalled();
  });

  it("finishes a covered closed market while the chain head keeps advancing", async () => {
    const f = fixture({ scanMaxChunksPerPass: 3 });
    const r = f.make();
    await r.scan();
    f.setHead(1_000_000n);
    await r.runDue();
    f.setHead(1_000_100n);
    await r.runDue();
    expect(f.held.size).toBe(0);
    expect(await f.pending()).toHaveLength(0);
  });

  it("resets an old ticket page when history coverage is widened", async () => {
    const f = fixture();
    f.setHead(109n);
    await f.store.sportsRecovery.enqueue({
      ...scope,
      marketId: 7n,
      requiredBlock: 109n,
      availableAt: f.now(),
      coverageStartBlock: 105n
    });
    const [old] = await f.pending();
    await f.store.sportsRecovery.checkpoint(old!, {
      ticketCursor: 2n,
      availableAt: f.now(),
      attempts: 0
    });
    const r = f.make();
    await r.scan(); // Earlier ticket 1 is now covered; no market event is replayed yet.
    await r.runDue();
    expect((await f.pending())[0]?.ticketCursor).toBe(0n);
    expect((await f.pending())[0]?.coverageStartBlock).toBe(100n);
    await r.runDue();
    await r.runDue();
    expect(f.deps.writeSettleTicket.mock.calls.map(([id]) => id)).toEqual([1n, 2n, 3n]);
    expect(await f.pending()).toHaveLength(0);
  });

  it("replays safely when receipt retrieval fails after a successful on-chain write", async () => {
    const f = fixture({ scanMaxChunksPerPass: 3 });
    f.deps.waitReceipt.mockRejectedValueOnce(new Error("connection lost after receipt"));
    const r = f.make();
    await r.scan();
    await r.runDue();
    expect(f.held.has(1n)).toBe(false);
    expect((await f.pending())[0]?.ticketCursor).toBe(0n);
    await r.stop();
    f.advance();
    const restarted = f.make();
    await restarted.runDue();
    await restarted.runDue();
    expect(f.deps.writeSettleTicket.mock.calls.map(([id]) => id)).toEqual([1n, 2n, 3n]);
    expect(await f.pending()).toHaveLength(0);
  });

  it("replays a failed page checkpoint without rebroadcasting settled tickets", async () => {
    const f = fixture({ scanMaxChunksPerPass: 3 });
    const checkpoint = vi
      .spyOn(f.store.sportsRecovery, "checkpoint")
      .mockRejectedValueOnce(new Error("crash before checkpoint"));
    const r = f.make();
    await r.scan();
    await expect(r.runDue()).rejects.toThrow("crash before checkpoint");
    expect((await f.pending())[0]?.ticketCursor).toBe(0n);
    await r.stop();
    const restarted = f.make();
    await restarted.runDue();
    await restarted.runDue();
    expect(f.deps.writeSettleTicket.mock.calls.map(([id]) => id)).toEqual([1n, 2n, 3n]);
    expect(checkpoint).toHaveBeenCalledTimes(3);
  });

  it("does not advance ticket coverage across a failed index write", async () => {
    const f = fixture({ sportsTicketIndexEnabled: true, scanMaxChunksPerPass: 3 });
    vi.spyOn(f.store, "writeSportsHubEvents").mockRejectedValueOnce(new Error("deadlock detected"));
    const r = f.make();
    await expect(r.scan()).rejects.toThrow("deadlock detected");
    expect(await f.store.getCursor(scope.chainId, sources.tickets, hub)).toBeNull();
    await r.scan();
    expect(await f.store.getCursor(scope.chainId, sources.tickets, hub)).toBe(129n);
    expect(await f.store.sportsRecovery.ticketPage(scope, 7n, 0n, 10)).toEqual([1n, 2n, 3n]);
  });

  it("keeps ticket coverage behind a failed RPC range and retries the same range", async () => {
    const f = fixture();
    f.events.mockRejectedValueOnce(new Error("provider timeout"));
    const r = f.make();
    await expect(r.scan()).rejects.toThrow("provider timeout");
    expect(await f.store.getCursor(scope.chainId, sources.tickets, hub)).toBeNull();
    await r.scan();
    expect(
      f.events.mock.calls.filter(([q]) => q.eventName === "TicketPlaced").map(([q]) => q.fromBlock)
    ).toEqual([100n, 100n]);
  });
});
