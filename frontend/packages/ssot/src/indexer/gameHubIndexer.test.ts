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

// Bet 9 is placed and settled within one batch.
const PLACED_9 = {
  eventName: "BetPlaced",
  blockNumber: 140n,
  logIndex: 0,
  transactionHash: "0xabc0",
  args: { positionId: 9n, player: "0x00000000000000000000000000000000000000A1" }
};
const FINALIZED_9 = {
  eventName: "BetFinalized",
  blockNumber: 150n,
  logIndex: 1,
  transactionHash: "0xabc1",
  args: { positionId: 9n }
};

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
  it.each([0, 1, 4, -1, 5.5, NaN, Infinity])(
    "rejects unsupported batchSize %s before reading or writing",
    (batchSize) => {
      const client = createMockPublicClient({});
      expect(() =>
        createGameHubIndexer({
          release: MOCK_RELEASE,
          publicClient: client,
          db,
          config: { batchSize }
        })
      ).toThrow("GameHub indexer batchSize must be an integer of at least 5 blocks");
      expect(client.getBlock).not.toHaveBeenCalled();
      expect(client.getLogs).not.toHaveBeenCalled();
      expect(db.isOpen()).toBe(false);
    }
  );

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
      client.getLogs.mockImplementation(async ({ events }: any) =>
        events.some((event: any) => event.name === "BetFinalized")
          ? [PLACED_9, { ...FINALIZED_9, args: { ...FINALIZED_9.args, ...amounts } }]
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
      const event = await db.gameHubEvents.get(`84532:${FINALIZED_9.transactionHash}:1`);
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
    client.getLogs.mockImplementation(async ({ events }: any) =>
      events.some((event: any) => event.name === "BetFinalized")
        ? [PLACED_9, { ...FINALIZED_9, args: { ...FINALIZED_9.args, ...amounts } }]
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

  it("reads all five events with one getLogs per batch", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: {
        confirmationSeconds: 0,
        rewindSeconds: 0,
        batchSize: 10000,
        pollIntervalMs: 999999,
        initialLookbackSeconds: 0
      }
    });

    await indexer.syncOnce();

    // The latest block, and once a sample behind it for the block rate.
    expect(client.getBlock).toHaveBeenCalledTimes(2);
    expect(client.getLogs).toHaveBeenCalledTimes(1);
    expect(client.getLogs.mock.calls[0][0].events.map((event: any) => event.name)).toEqual([
      "BetPlaced",
      "BetRandomReady",
      "BetFinalized",
      "BetRefunded",
      "BetVoided"
    ]);
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
        eventName: "BetPlaced",
        blockNumber: 150n,
        logIndex: 0,
        transactionHash: "0xabc1" as Hex,
        args: { positionId: 42n, gameId: "0x01" as Hex, player: "0xdeadbeef" as Address }
      }
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    client.getLogs.mockResolvedValueOnce(mockLogs);

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
        eventName: "BetPlaced",
        blockNumber: 150n,
        logIndex: 0,
        transactionHash: "0xabc1" as Hex,
        args: { positionId: 42n }
      }
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    client.getLogs.mockResolvedValue(mockLogs);

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

  it("keeps the confirmation and the rewind at least as long as configured across the switch to 200ms blocks", async () => {
    // Two-second blocks up to 10,000, then five a second (the independent review's witness, 2026-10-14).
    const denim = 10_000n;
    const stamp = (n: bigint) => (n <= denim ? n * 2n : denim * 2n + (n - denim) / 5n);
    const client = createMockPublicClient({ blockNumber: denim, timestampOf: stamp });
    const release = { ...MOCK_RELEASE, meta: { ...MOCK_RELEASE.meta, blockNumber: 9_900 } };
    indexer = createGameHubIndexer({ release: release as any, publicClient: client, db });
    let cursor: bigint | undefined;
    for (const head of [denim, 10_050n, 10_100n, 10_150n, 10_200n, 10_300n, 10_400n]) {
      client.state.head = head;
      client.getLogs.mockClear();
      await indexer.syncOnce();
      const status = indexer.getStatus();
      expect(status.lastError).toBeUndefined();
      const target = BigInt(status.targetBlock!);
      expect(stamp(head) - stamp(target)).toBeGreaterThanOrEqual(24n);
      const from = (client.getLogs.mock.calls as [{ fromBlock: bigint }][]).map(
        ([call]) => call.fromBlock
      );
      if (cursor != null && from.length) {
        const start = from.reduce((low, block) => (block < low ? block : low));
        expect(stamp(cursor) - stamp(start)).toBeGreaterThanOrEqual(48n);
      }
      cursor = target;
    }
    // Once the rate has settled the target is exactly 24 seconds old.
    expect(stamp(10_400n) - stamp(BigInt(indexer.getStatus().targetBlock!))).toBe(24n);
  });

  it("starts a fresh browser an hour before the target, not at the release block (2026-11-03 acceptance)", async () => {
    // Five blocks a second; the release block is 100, the head 100,000 blocks later.
    const client = createMockPublicClient({ blockNumber: 100_000n, timestampOf: (n) => n / 5n });
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    await indexer.syncOnce();
    expect(indexer.getStatus()).toMatchObject({ targetBlock: 99_880, lastSyncedBlock: 99_880 });
    const from = (client.getLogs.mock.calls as [{ fromBlock: bigint }][]).map(
      ([call]) => call.fromBlock
    );
    // A block 3,600 seconds before the target: 18,001 blocks in 91 queries, not 99,781 in 499.
    expect(from[0]).toBe(81_880n);
    expect(client.getLogs).toHaveBeenCalledTimes(91);
  });

  it("saves the cursor after each batch, so a failed or interrupted first pass resumes where it stopped", async () => {
    const client = createMockPublicClient({ blockNumber: 1_000n, timestampOf: (n) => n / 5n });
    client.getLogs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("rate limited"));
    indexer = createGameHubIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { rewindSeconds: 0 }
    });
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBe("rate limited");
    expect((await db.cursors.toArray())[0]?.lastProcessedBlock).toBe(499);
    client.getLogs.mockClear();
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBeUndefined();
    expect(client.getLogs.mock.calls[0][0].fromBlock).toBe(500n);
  });
});

describe("bets placed before a fresh browser's first range (2026-11-03 review A1)", () => {
  const A = "0x00000000000000000000000000000000000000A1";
  const B = "0x00000000000000000000000000000000000000B2";
  const AMOUNTS = { payoutGross: 200n, payoutNet: 196n, feeOnPayout: 4n, protocolFeeAccrual: 2n };

  function log(
    eventName: string,
    block: bigint,
    betId: bigint,
    args: Record<string, unknown> = {}
  ) {
    return {
      eventName,
      blockNumber: block,
      logIndex: 0,
      transactionHash: `0x${block.toString(16).padStart(64, "0")}`,
      args: { positionId: betId, ...args }
    };
  }

  /**
   * Five blocks a second. getLogs answers the query's range, events and bet; getBet gives the second of the bet's
   * placement, as the contract records it.
   */
  function chainOf(head: bigint, logs: ReturnType<typeof log>[]) {
    const placedAt = (betId: bigint) => {
      const placed = logs.find((l) => l.eventName === "BetPlaced" && l.args.positionId === betId);
      return placed ? placed.blockNumber / 5n : 0n;
    };
    return {
      getBlock: vi.fn(async (args?: { blockNumber?: bigint }) => {
        const number = args?.blockNumber ?? head;
        return { number, timestamp: number / 5n };
      }),
      getLogs: vi.fn(async (q: any) => {
        const names = (q.events ?? [q.event]).map((event: any) => event.name);
        return logs.filter(
          (l) =>
            l.blockNumber >= q.fromBlock &&
            l.blockNumber <= q.toBlock &&
            names.includes(l.eventName) &&
            (q.args?.positionId == null || q.args.positionId === l.args.positionId)
        );
      }),
      readContract: vi.fn(async (q: any) =>
        q.functionName === "getBet"
          ? { placedAt: placedAt(q.args[0]) }
          : { state: 4, ...AMOUNTS, refundAmount: 0n }
      )
    } as any;
  }

  const getBetCalls = (client: any, betId: bigint) =>
    client.readContract.mock.calls.filter(
      ([q]: any[]) => q.functionName === "getBet" && q.args[0] === betId
    ).length;
  const ranges = (client: any) =>
    (client.getLogs.mock.calls as [{ fromBlock: bigint; toBlock: bigint }][]).map(
      ([q]) => q.toBlock - q.fromBlock + 1n
    );

  it.each([5, 200])(
    "finds the first of five same-second blocks with batchSize %s",
    async (batchSize) => {
      const client = chainOf(100_500n, [
        log("BetPlaced", 100_000n, 1n, { player: A, stake: 100n }),
        log("BetRandomReady", 100_380n, 1n, { requestId: 1n })
      ]);
      indexer = createGameHubIndexer({
        release: MOCK_RELEASE,
        publicClient: client,
        db,
        config: { batchSize, initialLookbackSeconds: 10 }
      });
      await indexer.syncOnce();
      expect(indexer.getStatus().lastError).toBeUndefined();
      expect(await db.bets.get("84532:1")).toMatchObject({ player: A, state: "randomReady" });
      const placement = client.getLogs.mock.calls.find(([q]: any[]) => q.event)?.[0];
      expect(placement.fromBlock).toBeLessThanOrEqual(100_000n);
      expect(placement.toBlock).toBe(100_004n);
      expect(Math.max(...ranges(client).map(Number))).toBeLessThanOrEqual(batchSize);
    }
  );

  it("binds a refund an hour later to the bet's player, placed 176 seconds before the first range", async () => {
    // The target is 99,880 and the first range starts 3,600 seconds before it, at 81,880.
    const client = chainOf(100_000n, [
      log("BetPlaced", 81_000n, 1n, { player: A, stake: 100n }),
      log("BetRefunded", 99_000n, 1n, { refundAmount: 100n })
    ]);
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBeUndefined();
    expect(client.getLogs.mock.calls[0][0].fromBlock).toBe(81_880n);
    expect(await db.bets.get("84532:1")).toMatchObject({
      player: A,
      stake: "100",
      placedBlock: 81_000,
      state: "refunded",
      refundAmount: "100",
      updatedBlock: 99_000
    });
    // The placement is stored as the event it is.
    expect((await db.gameHubEvents.toArray()).map((event) => event.eventName).sort()).toEqual([
      "BetPlaced",
      "BetRefunded"
    ]);
    expect(Math.max(...ranges(client).map(Number))).toBeLessThanOrEqual(200);
  });

  it("binds a refund after a day's timeout, a refund three days late and a void after seven days", async () => {
    // The target is 3,999,880 (799,976 s) and the first range starts at 3,981,880 (796,376 s).
    const client = chainOf(4_000_000n, [
      // Refunded at 799,000 s after the longest refund timeout, 86,400 s.
      log("BetPlaced", 3_563_000n, 1n, { player: A }),
      log("BetRefunded", 3_995_000n, 1n, { refundAmount: 100n }),
      // A refund has no deadline: this one comes three days after the placement.
      log("BetPlaced", 2_694_000n, 2n, { player: A }),
      log("BetRefunded", 3_990_000n, 2n, { refundAmount: 100n }),
      // Another player's bet, voided seven days after it was placed.
      log("BetPlaced", 961_000n, 3n, { player: B }),
      log("BetVoided", 3_985_000n, 3n, { stake: 100n, caller: B }),
      // Placed two seconds before the first range; its result and settlement fall inside it.
      log("BetPlaced", 3_981_870n, 4n, { player: A }),
      log("BetRandomReady", 3_981_885n, 4n, { requestId: 4n }),
      log("BetFinalized", 3_981_890n, 4n, AMOUNTS)
    ]);
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    await indexer.syncOnce();
    expect(indexer.getStatus()).toMatchObject({ lastError: undefined, lastSyncedBlock: 3_999_880 });
    const rows = await db.bets.toArray();
    expect(rows.map((row) => [row.betId, row.player, row.state])).toEqual([
      ["1", A, "refunded"],
      ["2", A, "refunded"],
      ["3", B, "voided"],
      ["4", A, "finalized"]
    ]);
    // Bet 4 is looked up once, at its random; its settlement in the same batch finds the row.
    for (const betId of [1n, 2n, 3n, 4n]) expect(getBetCalls(client, betId)).toBe(1);
    expect(Math.max(...ranges(client).map(Number))).toBeLessThanOrEqual(200);
    // A few block reads a bet, however old: 91 batches and four placements.
    expect(client.getLogs).toHaveBeenCalledTimes(91 + 4);
    expect(client.getBlock.mock.calls.length).toBeLessThanOrEqual(4 + 4 * 9);
  });

  it("keeps the cursor and stores nothing of the batch while the placement cannot be read, then retries", async () => {
    const client = chainOf(100_000n, [
      log("BetPlaced", 60_000n, 1n, { player: A }),
      log("BetRefunded", 99_400n, 1n, { refundAmount: 100n })
    ]);
    const read = client.readContract.getMockImplementation();
    client.readContract.mockImplementationOnce(async () => {
      throw new Error("getBet unavailable");
    });
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    await indexer.syncOnce();
    // The refund's batch is 99,280–99,479: the cursor stays at the batch before it.
    expect(indexer.getStatus()).toMatchObject({
      lastError: "getBet unavailable",
      lastSyncedBlock: 99_279
    });
    expect((await db.cursors.toArray())[0]?.lastProcessedBlock).toBe(99_279);
    expect(await db.bets.count()).toBe(0);
    expect(await db.gameHubEvents.count()).toBe(0);
    client.readContract.mockImplementation(read);
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBeUndefined();
    expect(await db.bets.get("84532:1")).toMatchObject({ player: A, state: "refunded" });
    expect((await db.cursors.toArray())[0]?.lastProcessedBlock).toBe(99_880);
  });

  it("never takes another bet's placement, or one without a player, for a bet", async () => {
    for (const wrong of [
      log("BetPlaced", 60_000n, 2n, { player: B }),
      log("BetPlaced", 60_000n, 1n, {})
    ]) {
      const client = chainOf(100_000n, [
        log("BetPlaced", 60_000n, 1n, { player: A }),
        log("BetRefunded", 99_400n, 1n, { refundAmount: 100n })
      ]);
      const answer = client.getLogs.getMockImplementation();
      // An RPC that answers the placement query with the wrong log.
      client.getLogs.mockImplementation(async (q: any) => (q.event ? [wrong] : answer(q)));
      const local = new SSOTDb(`test-gameHub-wrong-${Date.now()}-${wrong.args.positionId}`);
      const ix = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db: local });
      await ix.syncOnce();
      expect(ix.getStatus().lastError).toBe("bet 1 placement not found");
      expect(await local.bets.count()).toBe(0);
      expect((await local.cursors.toArray())[0]?.lastProcessedBlock).toBe(99_279);
      await local.delete();
    }
  });

  it("keeps placements found before a batch failed, so the retry does not search for them again", async () => {
    const client = chainOf(100_000n, [
      log("BetPlaced", 60_000n, 1n, { player: A }),
      log("BetPlaced", 61_000n, 2n, { player: B }),
      log("BetRefunded", 99_400n, 1n, { refundAmount: 100n }),
      log("BetRefunded", 99_401n, 2n, { refundAmount: 100n })
    ]);
    const read = client.readContract.getMockImplementation();
    client.readContract.mockImplementation(async (q: any) => {
      if (q.functionName === "getBet" && q.args[0] === 2n && getBetCalls(client, 2n) === 1)
        throw new Error("getBet unavailable");
      return read(q);
    });
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBe("getBet unavailable");
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBeUndefined();
    expect((await db.bets.toArray()).map((row) => [row.player, row.state])).toEqual([
      [A, "refunded"],
      [B, "refunded"]
    ]);
    expect(getBetCalls(client, 1n)).toBe(1);
    expect(getBetCalls(client, 2n)).toBe(2);
  });

  it("joins a pass already running instead of starting a second over the same blocks", async () => {
    const client = chainOf(100_000n, []);
    indexer = createGameHubIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    const first = indexer.syncOnce();
    expect(indexer.syncOnce()).toBe(first);
    await first;
    expect(client.getLogs).toHaveBeenCalledTimes(91);
    // The next call is a new pass, from the cursor.
    await indexer.syncOnce();
    expect(client.getLogs.mock.calls.length).toBeGreaterThan(91);
  });
});
