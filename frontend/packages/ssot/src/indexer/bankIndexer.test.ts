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
    BankAbi: [
      { type: "event", name: "BetSettled", inputs: [{ name: "betId", type: "uint256", indexed: true }] },
      { type: "event", name: "XPAwarded", inputs: [{ name: "payee", type: "address", indexed: true }, { name: "accrued", type: "uint256" }] },
      { type: "event", name: "XPLockedUnlocked", inputs: [{ name: "payee", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
      { type: "event", name: "XPHoldbackReleased", inputs: [{ name: "payee", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
      { type: "event", name: "XPAccruedClaimed", inputs: [{ name: "payee", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
    ],
  }),
}));

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

describe("bankIndexer.syncOnce()", () => {
  it("fetches block number and getLogs for each bank × event type", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createBankIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    expect(client.getBlockNumber).toHaveBeenCalledTimes(1);
    // 1 bank × 5 event types = 5 getLogs calls
    expect(client.getLogs).toHaveBeenCalledTimes(5);
  });

  it("inserts cursor after sync", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createBankIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    const cursor = await db.cursors.get("84532:bank");
    expect(cursor).toBeDefined();
    expect(cursor!.lastProcessedBlock).toBe(200);
  });

  it("handles empty log batches without error", async () => {
    const client = createMockPublicClient({ blockNumber: 300n, logs: [] });
    indexer = createBankIndexer({
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

  it("stores bank events from BetSettled logs", async () => {
    const mockLogs = [
      {
        blockNumber: 150n,
        logIndex: 0,
        transactionHash: "0xabc1" as Hex,
        args: { betId: 42n, payout: 1000000n },
      },
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    // Return logs for BetSettled only
    client.getLogs
      .mockResolvedValueOnce(mockLogs) // BetSettled
      .mockResolvedValueOnce([])       // XPAwarded
      .mockResolvedValueOnce([])       // XPLockedUnlocked
      .mockResolvedValueOnce([])       // XPHoldbackReleased
      .mockResolvedValueOnce([]);      // XPAccruedClaimed

    indexer = createBankIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    const events = await db.bankEvents.toArray();
    expect(events.length).toBe(1);
    expect(events[0]!.eventName).toBe("BetSettled");
    expect(events[0]!.blockNumber).toBe(150);
  });

  it("stores XP snapshots from XPAwarded events", async () => {
    const payee = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
    const mockLogs = [
      {
        blockNumber: 160n,
        logIndex: 1,
        transactionHash: "0xdef1" as Hex,
        args: { payee, accrued: 5000n },
      },
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    client.getLogs
      .mockResolvedValueOnce([])       // BetSettled
      .mockResolvedValueOnce(mockLogs) // XPAwarded
      .mockResolvedValueOnce([])       // XPLockedUnlocked
      .mockResolvedValueOnce([])       // XPHoldbackReleased
      .mockResolvedValueOnce([]);      // XPAccruedClaimed

    indexer = createBankIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    // Both bankEvent and xpSnapshot should be created
    const bankEvents = await db.bankEvents.toArray();
    expect(bankEvents.length).toBe(1);
    expect(bankEvents[0]!.eventName).toBe("XPAwarded");

    const xpSnaps = await db.xpSnapshots.toArray();
    expect(xpSnaps.length).toBe(1);
    expect(xpSnaps[0]!.payee).toBe(payee);
    expect(xpSnaps[0]!.eventType).toBe("XPAwarded");
    expect(xpSnaps[0]!.amount).toBe("5000");
  });

  it("advances cursor correctly across multiple syncs", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    indexer = createBankIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();
    const cursor1 = await db.cursors.get("84532:bank");
    expect(cursor1!.lastProcessedBlock).toBe(200);

    client.getBlockNumber.mockResolvedValueOnce(500n);
    await indexer.syncOnce();
    const cursor2 = await db.cursors.get("84532:bank");
    expect(cursor2!.lastProcessedBlock).toBe(500);
  });

  it("catches errors and sets lastError in status", async () => {
    const client = createMockPublicClient({});
    client.getBlockNumber.mockRejectedValue(new Error("Bank RPC down"));

    indexer = createBankIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    const status = indexer.getStatus();
    expect(status.lastError).toBe("Bank RPC down");
  });

  it("BetSettled does NOT create xpSnapshot (only XP events do)", async () => {
    const mockLogs = [
      {
        blockNumber: 150n,
        logIndex: 0,
        transactionHash: "0xabc1" as Hex,
        args: { betId: 42n, payout: 1000000n },
      },
    ];

    const client = createMockPublicClient({ blockNumber: 200n });
    client.getLogs
      .mockResolvedValueOnce(mockLogs) // BetSettled
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    indexer = createBankIndexer({
      release: MOCK_RELEASE,
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0, batchSize: 10000, pollIntervalMs: 999999 },
    });

    await indexer.syncOnce();

    const xpSnaps = await db.xpSnapshots.toArray();
    expect(xpSnaps.length).toBe(0);
  });
});
