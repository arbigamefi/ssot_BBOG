import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Address, Hex } from "viem";
import { SSOTDb } from "./store";
import { createBankIndexer, type BankIndexer } from "./bankIndexer";
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

let db: SSOTDb;
let indexer: BankIndexer;

beforeEach(() => {
  db = new SSOTDb(`test-bank-${Date.now()}`);
});

afterEach(async () => {
  indexer?.stop();
  await db.delete();
});

describe("createBankIndexer", () => {
  it("returns an indexer with start, stop, syncOnce, getStatus", () => {
    const client = createMockPublicClient({});
    indexer = createBankIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    expect(indexer.start).toBeDefined();
    expect(indexer.stop).toBeDefined();
    expect(indexer.syncOnce).toBeDefined();
    expect(indexer.getStatus).toBeDefined();
  });

  it("getStatus returns initial status with chainId and bank addresses", () => {
    const client = createMockPublicClient({});
    indexer = createBankIndexer({ release: MOCK_RELEASE, publicClient: client, db });
    const status = indexer.getStatus();
    expect(status.chainId).toBe(84532);
    expect(status.banks.length).toBe(1);
    expect(status.banks[0]!.toLowerCase()).toBe("0x5555555555555555555555555555555555555555");
  });
});

const BANK = MOCK_RELEASE.pools[0]!.bank as Address;
const CURSOR = `84532:bank-events:100:${BANK.toLowerCase()}`;
const PLAYER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
function log(eventName: string, args: Record<string, unknown>, logIndex = 0, blockNumber = 150n) {
  return {
    address: BANK,
    eventName,
    args,
    blockNumber,
    logIndex,
    transactionHash: `0x${String(logIndex + 1).padStart(64, "0")}` as Hex
  };
}
function setup(client: any, rewindBlocks = 24) {
  indexer = createBankIndexer({
    release: MOCK_RELEASE,
    publicClient: client,
    db,
    config: { confirmations: 0, rewindBlocks, batchSize: 10_000, pollIntervalMs: 999_999 }
  });
}

describe("bankIndexer.syncOnce()", () => {
  it("does not reuse XP-only or other-Bank coverage when lifecycle decoding changes", async () => {
    await db.cursors.put({
      id: "84532:bank",
      chainId: 84532,
      source: BANK,
      lastProcessedBlock: 500,
      updatedAt: 0
    });
    const client = createMockPublicClient({ blockNumber: 200n });
    setup(client, 0);
    await indexer.syncOnce();
    expect(client.getLogs.mock.calls[0][0].fromBlock).toBe(100n);
    const otherBank = "0x6666666666666666666666666666666666666666" as Address;
    const other = createBankIndexer({
      release: { ...MOCK_RELEASE, pools: [{ ...MOCK_RELEASE.pools[0]!, bank: otherBank }] },
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0 }
    });
    await other.syncOnce();
    expect(client.getLogs.mock.calls[1][0]).toMatchObject({
      address: [otherBank],
      fromBlock: 100n
    });
  });

  it("reads all banks and lifecycle events with one RPC and advances an empty-range cursor", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    setup(client);
    await indexer.syncOnce();
    expect(client.getLogs).toHaveBeenCalledTimes(1);
    const query = client.getLogs.mock.calls[0][0];
    expect(query.address).toEqual([BANK]);
    expect(query.events.map((event: { name: string }) => event.name)).toEqual(
      expect.arrayContaining([
        "BetSettled",
        "RedeemRequest",
        "RedeemBatchPriced",
        "RedeemBatchActivated",
        "RecoveryClaimed",
        "RecoveryUpdated",
        "RecoverySynced",
        "Withdraw",
        "PlayerPayableCreated",
        "PlayerPayablePaid"
      ])
    );
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(200);
    expect(indexer.getStatus().lastSyncedBlock).toBe(200);
  });

  it("keeps requests, pricing, actual LP claims and deferred player payouts distinct under replay", async () => {
    const input = [
      log("RedeemRequest", { controller: PLAYER, owner: PLAYER, shares: 100n }, 0),
      log("RedeemBatchPriced", { batchId: 1n, shares: 100n, assets: 90n }, 1),
      log("RedeemClaimable", { controller: PLAYER, batchId: 1n, shares: 100n, assets: 90n }, 2),
      log("Withdraw", { owner: PLAYER, receiver: PLAYER, shares: 100n, assets: 90n }, 3),
      log("PlayerPayableCreated", { player: PLAYER, betId: 1n, amount: 50n }, 4),
      log("PlayerPayablePaid", { player: PLAYER, caller: PLAYER, amount: 50n }, 5),
      log("RedeemBatchActivated", { batchId: 1n, reserve: 20n, openHolds: 1n }, 6),
      log("RecoverySynced", { epochId: 1n, controller: PLAYER, shares: 100n, assets: 10n }, 7),
      log(
        "RecoveryClaimed",
        { epochId: 1n, controller: PLAYER, receiver: PLAYER, caller: PLAYER, assets: 10n },
        8
      )
    ];
    const client = createMockPublicClient({ blockNumber: 160n, logs: input });
    setup(client);
    await indexer.syncOnce();
    await indexer.syncOnce();
    const rows = await db.bankEvents.orderBy("logIndex").toArray();
    expect(rows.map((row) => row.eventName)).toEqual(input.map((row) => row.eventName));
    expect(rows.filter((row) => row.eventName === "Withdraw")).toHaveLength(1);
    expect(JSON.parse(rows[0]!.argsJson).shares).toBe("100");
    expect(await db.xpSnapshots.count()).toBe(0);
  });

  it("writes XP and raw facts atomically with the cursor, including their Bank identity", async () => {
    const client = createMockPublicClient({
      blockNumber: 200n,
      logs: [log("XPAwarded", { payee: PLAYER, accrued: 5000n }, 1)]
    });
    setup(client);
    await indexer.syncOnce();
    expect(await db.bankEvents.count()).toBe(1);
    expect(await db.xpSnapshots.toArray()).toMatchObject([
      { bank: BANK, payee: PLAYER, amount: "5000" }
    ]);
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(200);
  });

  it("removes orphaned withdrawal and XP facts when a rewound range becomes empty", async () => {
    const client = createMockPublicClient({
      blockNumber: 160n,
      logs: [
        log(
          "RecoveryClaimed",
          { epochId: 1n, controller: PLAYER, receiver: PLAYER, caller: PLAYER, assets: 1n },
          0
        ),
        log("XPAwarded", { payee: PLAYER, accrued: 5000n }, 1)
      ]
    });
    setup(client);
    await indexer.syncOnce();
    expect(await db.bankEvents.count()).toBe(2);
    client.getLogs.mockResolvedValue([]);
    await indexer.syncOnce();
    expect(await db.bankEvents.count()).toBe(0);
    expect(await db.xpSnapshots.count()).toBe(0);
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(160);
  });

  it("does not delete facts or advance its checkpoint when a read fails", async () => {
    const client = createMockPublicClient({
      blockNumber: 160n,
      logs: [log("RedeemRequest", { shares: 1n })]
    });
    setup(client);
    await indexer.syncOnce();
    client.getBlockNumber.mockResolvedValue(170n);
    client.getLogs.mockRejectedValue(new Error("RPC down"));
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBe("RPC down");
    expect(await db.bankEvents.count()).toBe(1);
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(160);
  });

  it("rolls back replacement facts and cursor together when storage fails", async () => {
    const client = createMockPublicClient({
      blockNumber: 160n,
      logs: [log("RedeemRequest", { shares: 1n })]
    });
    setup(client);
    await indexer.syncOnce();
    const put = vi.spyOn(db.cursors, "put").mockRejectedValueOnce(new Error("disk full"));
    client.getBlockNumber.mockResolvedValue(170n);
    client.getLogs.mockResolvedValue([log("Withdraw", { shares: 1n, assets: 1n })]);
    await indexer.syncOnce();
    put.mockRestore();
    expect(indexer.getStatus().lastError).toBe("disk full");
    expect((await db.bankEvents.toArray()).map((row) => row.eventName)).toEqual(["RedeemRequest"]);
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(160);
  });

  it("coalesces a timer tick and manual refresh while RPC is in flight", async () => {
    const client = createMockPublicClient({});
    setup(client);
    await Promise.all([indexer.syncOnce(), indexer.syncOnce()]);
    expect(client.getBlockNumber).toHaveBeenCalledTimes(1);
    expect(client.getLogs).toHaveBeenCalledTimes(1);
  });
});
