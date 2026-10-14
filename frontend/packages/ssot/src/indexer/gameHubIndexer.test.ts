import "fake-indexeddb/auto";
import Dexie from "dexie";
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
    governanceTimelock: "0x7777777777777777777777777777777777777777",
    gameHub: "0x1111111111111111111111111111111111111111",
    settlementRouter: "0x2222222222222222222222222222222222222222",
    poolRegistry: "0x3333333333333333333333333333333333333333",
    vrfHub: "0x9999999999999999999999999999999999999999",
    refRegistry: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    refEngine: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  assets: [
    {
      symbol: "USDC",
      decimals: 6,
      address: "0x4444444444444444444444444444444444444444",
      vault: "0xcccccccccccccccccccccccccccccccccccccccc",
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
      maxBetCount: 25,
      callbackGasLimit: 2447746,
      module: "0x6666666666666666666666666666666666666666"
    }
  ],
  pools: [
    {
      poolId: 1,
      domainId: 1,
      domain: "Casino",
      asset: "0x4444444444444444444444444444444444444444",
      vault: "0xcccccccccccccccccccccccccccccccccccccccc",
      bank: "0x5555555555555555555555555555555555555555",
      symbol: "USDC",
      decimals: 6
    }
  ],
  meta: {
    blockNumber: 100,
    schemaVersion: 2,
    architectureVersion: "v1.6-nft-liquidity",
    releaseLock: { schema: "SSOT_RELEASE_DIGEST_V16" }
  }
};

// ——— Mock publicClient ———
// Block `n` has timestamp `timestampOf(n)`: two-second blocks by default, as before Denim.
function createMockPublicClient(opts: {
  blockNumber?: bigint;
  logs?: any[];
  timestampOf?: (n: bigint) => bigint;
}) {
  const state = { head: opts.blockNumber ?? 200n };
  const timestampOf = opts.timestampOf ?? ((n: bigint) => n * 2n);
  return {
    state,
    getBlock: vi.fn(async (args?: { blockNumber?: bigint }) => {
      const number = args?.blockNumber ?? state.head;
      return { number, timestamp: timestampOf(number) };
    }),
    getLogs: vi.fn().mockResolvedValue(opts.logs ?? [])
  } as any;
}

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
  it.each([0n, 100_000n])(
    "persists a proven terminal refund %s outside the IndexedDB transaction",
    async (refundAmount) => {
      const amounts = {
        payoutGross: 200_000n,
        payoutNet: 196_000n,
        feeOnPayout: 4_000n,
        protocolFeeAccrual: 2_000n
      };
      const client = createMockPublicClient({ blockNumber: 200n });
      client.getLogs.mockImplementation(async ({ event }: any) =>
        event.name === "BetFinalized"
          ? [
              {
                blockNumber: 150n,
                logIndex: 1,
                transactionHash: "0xabc1",
                args: { positionId: 9n, ...amounts }
              }
            ]
          : []
      );
      client.readContract = vi.fn(async () => {
        expect(Dexie.currentTransaction).toBeNull();
        return { state: 4, ...amounts, refundAmount };
      });
      indexer = createGameHubIndexer({
        release: MOCK_RELEASE,
        publicClient: client,
        db,
        config: { confirmationSeconds: 0 }
      });
      await indexer.syncOnce();
      expect(indexer.getStatus().lastError).toBeUndefined();
      expect(await db.bets.get("84532:9")).toMatchObject({
        payout: "196000",
        refundAmount: refundAmount.toString()
      });
      const [event] = await db.gameHubEvents.toArray();
      expect(JSON.parse(event!.argsJson).refundAmount).toBe(refundAmount.toString());
    }
  );

  it("keeps the cursor and financial rows unchanged until terminal refund recovery succeeds", async () => {
    const amounts = {
      payoutGross: 200_000n,
      payoutNet: 196_000n,
      feeOnPayout: 4_000n,
      protocolFeeAccrual: 2_000n
    };
    const client = createMockPublicClient({ blockNumber: 200n });
    client.getLogs.mockImplementation(async ({ event }: any) =>
      event.name === "BetFinalized"
        ? [
            {
              blockNumber: 150n,
              logIndex: 1,
              transactionHash: "0xabc1",
              args: { positionId: 9n, ...amounts }
            }
          ]
        : []
    );
    client.readContract = vi
      .fn()
      .mockRejectedValueOnce(new Error("terminal RPC unavailable"))
      .mockResolvedValue({ state: 4, ...amounts, refundAmount: 100_000n });
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmationSeconds: 0 }
    });
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBe("terminal RPC unavailable");
    expect(await db.cursors.count()).toBe(0);
    expect(await db.bets.count()).toBe(0);
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBeUndefined();
    expect(await db.bets.get("84532:9")).toMatchObject({ refundAmount: "100000" });
    expect((await db.cursors.toArray())[0]?.lastProcessedBlock).toBe(200);
  });

  it("fetches block number and getLogs for each event type", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmationSeconds: 0, rewindSeconds: 0, batchSize: 10000, pollIntervalMs: 999999 }
    });

    await indexer.syncOnce();

    // The latest block, and once a sample behind it for the block rate.
    expect(client.getBlock).toHaveBeenCalledTimes(2);
    // 5 event types → 5 getLogs calls
    expect(client.getLogs).toHaveBeenCalledTimes(5);
  });

  it("inserts cursor after sync", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmationSeconds: 0, rewindSeconds: 0, batchSize: 10000, pollIntervalMs: 999999 }
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
      config: { confirmationSeconds: 0, rewindSeconds: 0, batchSize: 10000, pollIntervalMs: 999999 }
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
        args: { positionId: 42n, gameId: "0x01" as Hex, player: "0xdeadbeef" as Address }
      }
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    // Only return logs for BetPlaced, empty for others
    client.getLogs
      .mockResolvedValueOnce(mockLogs) // BetPlaced
      .mockResolvedValueOnce([]) // BetRandomReady
      .mockResolvedValueOnce([]) // BetFinalized
      .mockResolvedValueOnce([]) // BetRefunded
      .mockResolvedValueOnce([]); // BetVoided

    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmationSeconds: 0, rewindSeconds: 0, batchSize: 10000, pollIntervalMs: 999999 }
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
      config: { confirmationSeconds: 0, rewindSeconds: 0, batchSize: 10000, pollIntervalMs: 999999 }
    });

    await indexer.syncOnce();

    const cursorId = `84532:0x1111111111111111111111111111111111111111`;
    const cursor1 = await db.cursors.get(cursorId);
    expect(cursor1!.lastProcessedBlock).toBe(200);

    // Second sync with higher block number
    client.state.head = 500n;
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
      config: {
        confirmationSeconds: 200,
        rewindSeconds: 0,
        batchSize: 10000,
        pollIntervalMs: 999999
      }
    });

    // 200 seconds are 100 blocks: targetBlock = max(0, 50 - 100) = 0, fromBlock = 100 (meta.blockNumber)
    // So fromBlock (100) > targetBlock (0) → skip
    await indexer.syncOnce();

    // getLogs should not be called because sync was skipped
    expect(client.getLogs).not.toHaveBeenCalled();
  });

  it("catches errors and sets lastError in status", async () => {
    const client = createMockPublicClient({});
    client.getBlock.mockRejectedValue(new Error("RPC down"));

    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmationSeconds: 0, rewindSeconds: 0, batchSize: 10000, pollIntervalMs: 999999 }
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
        args: { positionId: 42n }
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
      config: {
        confirmationSeconds: 0,
        rewindSeconds: 20,
        batchSize: 10000,
        pollIntervalMs: 999999
      }
    });

    await indexer.syncOnce();
    await indexer.syncOnce();

    // Should still only have 1 event row (put is upsert)
    const events = await db.gameHubEvents.toArray();
    expect(events.length).toBe(1);
  });

  it("waits and rereads by seconds at five blocks a second after Denim, in 200-block log ranges", async () => {
    const client = createMockPublicClient({ blockNumber: 10_000n, timestampOf: (n) => n / 5n });
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    const ranges = () =>
      [
        ...new Set(
          client.getLogs.mock.calls.map(
            ([call]: [{ fromBlock: bigint; toBlock: bigint }]) =>
              `${call.fromBlock}-${call.toBlock}`
          )
        )
      ] as string[];

    await indexer.syncOnce();
    // 24 seconds are 120 blocks: everything from the release block through 9,880.
    expect(indexer.getStatus()).toMatchObject({
      latestBlock: 10_000,
      targetBlock: 9_880,
      lastSyncedBlock: 9_880,
      blocksPerSecond: 5
    });
    expect(ranges().at(0)).toBe("100-299");
    expect(ranges().at(-1)).toBe("9700-9880");

    client.getLogs.mockClear();
    client.state.head = 10_050n;
    await indexer.syncOnce();
    // The 48-second rewind is 240 blocks before the cursor.
    expect(ranges()).toEqual(["9641-9840", "9841-9930"]);
  });

  it("keeps the twelve-block wait of two-second blocks before Denim", async () => {
    const client = createMockPublicClient({ blockNumber: 10_000n });
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    await indexer.syncOnce();
    expect(indexer.getStatus()).toMatchObject({ targetBlock: 9_988, blocksPerSecond: 0.5 });
  });
});
