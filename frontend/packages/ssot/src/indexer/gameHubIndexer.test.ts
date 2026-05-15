import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Address, Hex } from "viem";
import { SSOTDb } from "./store";
import { createGameHubIndexer, type GameHubIndexer } from "./gameHubIndexer";
import type { SSOTRelease } from "../release/schema";

// ——— Mock release ———
const MOCK_RELEASE: SSOTRelease = {
  chainId: 84532,
  name: "test-release",
  releaseDigest: "0xdeadbeef",
  isPlaceholder: false,
  contracts: {
    gameHub: "0x1111111111111111111111111111111111111111",
    settlementRouter: "0x2222222222222222222222222222222222222222",
    poolRegistry: "0x3333333333333333333333333333333333333333",
    sportsHub: "0x7777777777777777777777777777777777777777",
    sportsRiskEngine: "0x8888888888888888888888888888888888888888",
    vrfHub: "0x9999999999999999999999999999999999999999",
    refRegistry: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    refEngine: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    adapter: "0xcccccccccccccccccccccccccccccccccccccccc"
  },
  assets: [
    {
      symbol: "USDC",
      decimals: 6,
      address: "0x4444444444444444444444444444444444444444",
      bank: "0x5555555555555555555555555555555555555555"
    }
  ],
  games: {
    "0x0000000000000000000000000000000000000000000000000000000000000001":
      "0x6666666666666666666666666666666666666666"
  },
  gamesMeta: [
    {
      gameId: "0x0000000000000000000000000000000000000000000000000000000000000001",
      slug: "dice",
      label: "Dice",
      module: "0x6666666666666666666666666666666666666666"
    }
  ],
  sports: {
    enabled: false,
    riskEngine: "0x8888888888888888888888888888888888888888",
    sportsHub: "0x7777777777777777777777777777777777777777",
    oddsSignerSetHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    resultReporterSetHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    resultReporterThreshold: "1",
    maxStake: "1",
    maxPayout: "1",
    maxMarketReserved: "1",
    maxOutcomeReserved: "1",
    maxEventReserved: "1"
  },
  pools: [
    {
      poolId: 1,
      domainId: 1,
      domain: "Casino",
      active: true,
      asset: "0x4444444444444444444444444444444444444444",
      bank: "0x5555555555555555555555555555555555555555",
      symbol: "USDC",
      decimals: 6,
      sportsRisk: null
    }
  ],
  meta: { blockNumber: 100, schemaVersion: 2 }
};

// ——— Mock publicClient ———
function createMockPublicClient(opts: { blockNumber?: bigint; logs?: any[] }) {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(opts.blockNumber ?? 200n),
    getLogs: vi.fn().mockResolvedValue(opts.logs ?? [])
  } as any;
}

// ——— Mock ABI resolver ———
vi.mock("../abis/release/resolver", () => ({
  getReleaseAbis: () => ({
    GameHubAbi: [
      {
        type: "event",
        name: "BetPlaced",
        inputs: [{ name: "betId", type: "uint256", indexed: true }]
      },
      {
        type: "event",
        name: "BetRandomReady",
        inputs: [{ name: "betId", type: "uint256", indexed: true }]
      },
      {
        type: "event",
        name: "BetFinalized",
        inputs: [{ name: "betId", type: "uint256", indexed: true }]
      },
      {
        type: "event",
        name: "BetRefunded",
        inputs: [{ name: "betId", type: "uint256", indexed: true }]
      }
    ]
  })
}));

let db: SSOTDb;
let indexer: GameHubIndexer;

beforeEach(() => {
  db = new SSOTDb(`test-gameHub-${Date.now()}`);
});

afterEach(async () => {
  indexer?.stop();
  await db.delete();
});

describe("createGameHubIndexer", () => {
  it("returns an indexer with start, stop, syncOnce, getStatus", () => {
    const client = createMockPublicClient({});
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    expect(indexer.start).toBeDefined();
    expect(indexer.stop).toBeDefined();
    expect(indexer.syncOnce).toBeDefined();
    expect(indexer.getStatus).toBeDefined();
  });

  it("getStatus returns initial status with chainId and gameHub", () => {
    const client = createMockPublicClient({});
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    const status = indexer.getStatus();
    expect(status.chainId).toBe(84532);
    expect(status.gameHub.toLowerCase()).toBe("0x1111111111111111111111111111111111111111");
  });
});

describe("gameHubIndexer.syncOnce()", () => {
  it("fetches block number and getLogs for each event type", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 }
    });

    await indexer.syncOnce();

    expect(client.getBlockNumber).toHaveBeenCalledTimes(1);
    // 4 event types → 4 getLogs calls
    expect(client.getLogs).toHaveBeenCalledTimes(4);
  });

  it("inserts cursor after sync", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 }
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
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 }
    });

    await indexer.syncOnce();

    const status = indexer.getStatus();
    expect(status.lastError).toBeUndefined();
    expect(status.lastSyncedBlock).toBe(300);
  });

  it("stores GameHub events and creates bet rows from logs", async () => {
    const mockLogs = [
      {
        blockNumber: 150n,
        logIndex: 0,
        transactionHash: "0xabc1" as Hex,
        args: { betId: 42n, gameId: "0x01" as Hex, player: "0xdeadbeef" as Address }
      }
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    // Only return logs for BetPlaced, empty for others
    client.getLogs
      .mockResolvedValueOnce(mockLogs) // BetPlaced
      .mockResolvedValueOnce([]) // BetRandomReady
      .mockResolvedValueOnce([]) // BetFinalized
      .mockResolvedValueOnce([]); // BetRefunded

    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 }
    });

    await indexer.syncOnce();

    // Verify gameHub event was stored
    const events = await db.gameHubEvents.toArray();
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
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 }
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
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 100, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 }
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

    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 }
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
        args: { betId: 42n }
      }
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    client.getLogs
      .mockResolvedValueOnce(mockLogs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockLogs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 10, batchSize: 10000, pollIntervalMs: 999999 }
    });

    await indexer.syncOnce();
    await indexer.syncOnce();

    // Should still only have 1 event row (put is upsert)
    const events = await db.gameHubEvents.toArray();
    expect(events.length).toBe(1);
  });
});
