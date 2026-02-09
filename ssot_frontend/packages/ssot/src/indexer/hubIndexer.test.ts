import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Address, Hex } from "viem";
import { SSOTDb } from "./store";
import { createHubIndexer, type HubIndexer } from "./hubIndexer";
import type { SSOTRelease } from "../release/schema";

// ——— Mock release ———
const MOCK_RELEASE: SSOTRelease = {
  chainId: 84532,
  name: "test-release",
  releaseDigest: "0xdeadbeef",
  isPlaceholder: false,
  contracts: {
    hub: "0x1111111111111111111111111111111111111111",
    vrfHub: "0x2222222222222222222222222222222222222222",
    bankRegistry: "0x3333333333333333333333333333333333333333",
  },
  assets: [
    {
      symbol: "USDC",
      decimals: 6,
      address: "0x4444444444444444444444444444444444444444",
      bank: "0x5555555555555555555555555555555555555555",
    },
  ],
  games: {
    "0x0000000000000000000000000000000000000000000000000000000000000001":
      "0x6666666666666666666666666666666666666666",
  },
  meta: { blockNumber: 100 },
};

// ——— Mock publicClient ———
function createMockPublicClient(opts: {
  blockNumber?: bigint;
  logs?: any[];
}) {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(opts.blockNumber ?? 200n),
    getLogs: vi.fn().mockResolvedValue(opts.logs ?? []),
  } as any;
}

// ——— Mock ABI resolver ———
vi.mock("../abis/release/resolver", () => ({
  getReleaseAbis: () => ({
    HubAbi: [
      { type: "event", name: "BetPlaced", inputs: [{ name: "betId", type: "uint256", indexed: true }] },
      { type: "event", name: "BetRandomReady", inputs: [{ name: "betId", type: "uint256", indexed: true }] },
      { type: "event", name: "BetFinalized", inputs: [{ name: "betId", type: "uint256", indexed: true }] },
      { type: "event", name: "BetRefunded", inputs: [{ name: "betId", type: "uint256", indexed: true }] },
    ],
  }),
}));

let db: SSOTDb;
let indexer: HubIndexer;

beforeEach(() => {
  db = new SSOTDb(`test-hub-${Date.now()}`);
});

afterEach(async () => {
  indexer?.stop();
  await db.delete();
});

describe("createHubIndexer", () => {
  it("returns an indexer with start, stop, syncOnce, getStatus", () => {
    const client = createMockPublicClient({});
    indexer = createHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    expect(indexer.start).toBeDefined();
    expect(indexer.stop).toBeDefined();
    expect(indexer.syncOnce).toBeDefined();
    expect(indexer.getStatus).toBeDefined();
  });

  it("getStatus returns initial status with chainId and hub", () => {
    const client = createMockPublicClient({});
    indexer = createHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    const status = indexer.getStatus();
    expect(status.chainId).toBe(84532);
    expect(status.hub.toLowerCase()).toBe("0x1111111111111111111111111111111111111111");
  });
});

describe("hubIndexer.syncOnce()", () => {
  it("fetches block number and getLogs for each event type", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    expect(client.getBlockNumber).toHaveBeenCalledTimes(1);
    // 4 event types → 4 getLogs calls
    expect(client.getLogs).toHaveBeenCalledTimes(4);
  });

  it("inserts cursor after sync", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    const cursorId = `84532:0x1111111111111111111111111111111111111111`;
    const cursor = await db.cursors.get(cursorId);
    expect(cursor).toBeDefined();
    expect(cursor!.lastProcessedBlock).toBe(200);
    expect(cursor!.chainId).toBe(84532);
  });

  it("handles empty log batches without error", async () => {
    const client = createMockPublicClient({ blockNumber: 300n, logs: [] });
    indexer = createHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    const status = indexer.getStatus();
    expect(status.lastError).toBeUndefined();
    expect(status.lastSyncedBlock).toBe(300);
  });

  it("stores hub events and creates bet rows from logs", async () => {
    const mockLogs = [
      {
        blockNumber: 150n,
        logIndex: 0,
        transactionHash: "0xabc1" as Hex,
        args: { betId: 42n, gameId: "0x01" as Hex, player: "0xdeadbeef" as Address },
      },
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    // Only return logs for BetPlaced, empty for others
    client.getLogs
      .mockResolvedValueOnce(mockLogs) // BetPlaced
      .mockResolvedValueOnce([])       // BetRandomReady
      .mockResolvedValueOnce([])       // BetFinalized
      .mockResolvedValueOnce([]);      // BetRefunded

    indexer = createHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    // Verify hub event was stored
    const events = await db.hubEvents.toArray();
    expect(events.length).toBe(1);
    expect(events[0]!.eventName).toBe("BetPlaced");

    // Verify bet row was created
    const bets = await db.bets.toArray();
    expect(bets.length).toBe(1);
    expect(bets[0]!.state).toBe("placed");
    expect(bets[0]!.betId).toBe("42");
  });

  it("advances cursor correctly across multiple syncs", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    const cursorId = `84532:0x1111111111111111111111111111111111111111`;
    const cursor1 = await db.cursors.get(cursorId);
    expect(cursor1!.lastProcessedBlock).toBe(200);

    // Second sync with higher block number
    client.getBlockNumber.mockResolvedValueOnce(500n);
    await indexer.syncOnce();

    const cursor2 = await db.cursors.get(cursorId);
    expect(cursor2!.lastProcessedBlock).toBe(500);
  });

  it("skips sync when fromBlock > targetBlock", async () => {
    const client = createMockPublicClient({ blockNumber: 50n });
    indexer = createHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 100, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    // targetBlock = 50 - 100 = max(0, -50) = 0, fromBlock = 100 (meta.blockNumber)
    // So fromBlock (100) > targetBlock (0) → skip
    await indexer.syncOnce();

    // getLogs should not be called because sync was skipped
    expect(client.getLogs).not.toHaveBeenCalled();
  });

  it("catches errors and sets lastError in status", async () => {
    const client = createMockPublicClient({});
    client.getBlockNumber.mockRejectedValue(new Error("RPC down"));

    indexer = createHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    const status = indexer.getStatus();
    expect(status.lastError).toBe("RPC down");
  });

  it("idempotent: duplicate events overwrite without error", async () => {
    const mockLogs = [
      {
        blockNumber: 150n,
        logIndex: 0,
        transactionHash: "0xabc1" as Hex,
        args: { betId: 42n },
      },
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    client.getLogs
      .mockResolvedValueOnce(mockLogs)
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockLogs)
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    indexer = createHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 10, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();
    await indexer.syncOnce();

    // Should still only have 1 event row (put is upsert)
    const events = await db.hubEvents.toArray();
    expect(events.length).toBe(1);
  });
});
