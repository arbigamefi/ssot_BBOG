import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Address, Hex } from "viem";
import { SSOTDb } from "./store";
import { createBankIndexer, type BankIndexer } from "./bankIndexer";
import type { SSOTRelease } from "../release/schema";

import releaseFixture from "../fixtures/release-v16.fixture.json";

const MOCK_RELEASE: SSOTRelease = {
  ...(releaseFixture as SSOTRelease),
  chainId: 84532,
  isPlaceholder: false,
  meta: { ...(releaseFixture as SSOTRelease).meta, blockNumber: 100 }
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
    expect(status.banks[0]!.toLowerCase()).toBe(BANK.toLowerCase());
  });
});

const BANK = MOCK_RELEASE.pools[0]!.bank as Address;
const VAULT = MOCK_RELEASE.pools[0]!.vault as Address;
const CURSOR = `84532:liquidity-events:100:${BANK.toLowerCase()}:${VAULT.toLowerCase()}`;
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

function vaultLog(eventName: string, args: Record<string, unknown>, index = 0) {
  return { ...log(eventName, args, index), address: VAULT };
}

describe("bankIndexer.syncOnce()", () => {
  it("binds the checkpoint to both Bank and Vault", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    setup(client, 0);
    await indexer.syncOnce();
    const otherBank = "0x6666666666666666666666666666666666666666" as Address;
    const otherVault = "0x7777777777777777777777777777777777777777" as Address;
    const other = createBankIndexer({
      release: {
        ...MOCK_RELEASE,
        pools: [{ ...MOCK_RELEASE.pools[0]!, bank: otherBank, vault: otherVault }]
      },
      publicClient: client,
      db,
      config: { confirmations: 0, rewindBlocks: 0 }
    });
    await other.syncOnce();
    expect(client.getLogs.mock.calls[2][0]).toMatchObject({
      address: [otherBank],
      fromBlock: 100n
    });
    expect(client.getLogs.mock.calls[3][0]).toMatchObject({
      address: [otherVault],
      fromBlock: 100n
    });
  });

  it("queries the two event sources and advances an empty range together", async () => {
    const client = createMockPublicClient({ blockNumber: 200n });
    setup(client);
    await indexer.syncOnce();
    expect(client.getLogs).toHaveBeenCalledTimes(2);
    const [bankQuery, vaultQuery] = client.getLogs.mock.calls.map((call: any[]) => call[0]);
    expect(bankQuery.address).toEqual([BANK]);
    expect(bankQuery.events.map((event: { name: string }) => event.name)).toEqual(
      expect.arrayContaining([
        "BetSettled",
        "PlayerPayableCreated",
        "PlayerPayablePaid",
        "XPAwarded"
      ])
    );
    expect(vaultQuery.address).toEqual([VAULT.toLowerCase()]);
    expect(vaultQuery.events.map((event: { name: string }) => event.name)).toEqual([
      "DepositAdded",
      "DepositWithdrawn",
      "Transfer"
    ]);
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(200);
  });

  it("keeps NFT ownership, cash and player payments separate and idempotent", async () => {
    const input = [
      vaultLog(
        "DepositAdded",
        {
          payer: PLAYER,
          owner: PLAYER,
          depositId: 1099511627776,
          assets: 100n,
          withdrawAfter: 1000n
        },
        0
      ),
      vaultLog("Transfer", { from: PLAYER, to: BANK, tokenId: 1099511627776n }, 1),
      vaultLog(
        "DepositWithdrawn",
        {
          owner: BANK,
          depositId: 1099511627776,
          percent: 500000000000,
          assets: 40n,
          withdrawAfter: 2000n
        },
        2
      ),
      log("PlayerPayableCreated", { player: PLAYER, betId: 1n, amount: 50n }, 3),
      log("PlayerPayablePaid", { player: PLAYER, caller: PLAYER, amount: 50n }, 4)
    ];
    const client = createMockPublicClient({ blockNumber: 160n, logs: input });
    setup(client);
    await indexer.syncOnce();
    await indexer.syncOnce();
    expect(
      (await db.vaultEvents.orderBy("logIndex").toArray()).map((row) => row.eventName)
    ).toEqual(["DepositAdded", "Transfer", "DepositWithdrawn"]);
    expect((await db.bankEvents.orderBy("logIndex").toArray()).map((row) => row.eventName)).toEqual(
      ["PlayerPayableCreated", "PlayerPayablePaid"]
    );
    const deposit = await db.vaultEvents.where("eventName").equals("DepositAdded").first();
    expect(deposit).toMatchObject({ bank: BANK, vault: VAULT.toLowerCase() });
    expect(JSON.parse(deposit!.argsJson)).toMatchObject({
      depositId: 1099511627776,
      assets: "100"
    });
    expect(await db.xpSnapshots.count()).toBe(0);
  });

  it("writes XP facts atomically with their Bank identity", async () => {
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

  it("removes orphaned Vault and XP facts when a rewound range becomes empty", async () => {
    const client = createMockPublicClient({
      blockNumber: 160n,
      logs: [
        vaultLog("DepositWithdrawn", {
          owner: PLAYER,
          depositId: 1,
          assets: 1n,
          percent: 1000000000000,
          withdrawAfter: 0n
        }),
        log("XPAwarded", { payee: PLAYER, accrued: 5000n }, 1)
      ]
    });
    setup(client);
    await indexer.syncOnce();
    expect(await db.vaultEvents.count()).toBe(1);
    expect(await db.bankEvents.count()).toBe(1);
    client.getLogs.mockResolvedValue([]);
    await indexer.syncOnce();
    expect(await db.vaultEvents.count()).toBe(0);
    expect(await db.bankEvents.count()).toBe(0);
    expect(await db.xpSnapshots.count()).toBe(0);
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(160);
  });

  it("preserves both event stores and checkpoint if either RPC fails", async () => {
    const client = createMockPublicClient({
      blockNumber: 160n,
      logs: [vaultLog("DepositAdded", { depositId: 1, assets: 1n })]
    });
    setup(client);
    await indexer.syncOnce();
    client.getBlockNumber.mockResolvedValue(170n);
    client.getLogs.mockImplementation(async ({ address }: { address: Address[] }) => {
      if (address.includes(VAULT)) throw new Error("Vault RPC down");
      return [];
    });
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBe("Vault RPC down");
    expect(await db.vaultEvents.count()).toBe(1);
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(160);
  });

  it.each([150n, 120n, 90n])("drops orphaned tails when the head retreats to %s", async (head) => {
    const client = createMockPublicClient({
      blockNumber: 160n,
      logs: [
        { ...vaultLog("DepositAdded", { depositId: 1, assets: 1n }), blockNumber: 158n },
        log("XPAwarded", { payee: PLAYER, accrued: 5000n }, 1, 158n)
      ]
    });
    setup(client);
    await indexer.syncOnce();
    const [vaultRow] = await db.vaultEvents.toArray();
    await db.vaultEvents.put({ ...vaultRow!, id: "other-chain", chainId: 999 });
    client.getBlockNumber.mockResolvedValue(head);
    client.getLogs.mockResolvedValue([]);
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBeUndefined();
    expect(await db.vaultEvents.toArray()).toMatchObject([{ id: "other-chain" }]);
    expect(await db.bankEvents.count()).toBe(0);
    expect(await db.xpSnapshots.count()).toBe(0);
    expect((await db.cursors.get(CURSOR))?.lastProcessedBlock).toBe(
      head < 100n ? undefined : Number(head)
    );
    expect(indexer.getStatus().lastSyncedBlock).toBe(head < 100n ? undefined : Number(head));
  });

  it("keeps a lowered coverage boundary if replay fails after head rollback", async () => {
    const client = createMockPublicClient({
      blockNumber: 160n,
      logs: [{ ...vaultLog("DepositAdded", { depositId: 1, assets: 1n }), blockNumber: 158n }]
    });
    setup(client);
    await indexer.syncOnce();
    client.getBlockNumber.mockResolvedValue(150n);
    client.getLogs.mockRejectedValue(new Error("replay RPC failed"));
    await indexer.syncOnce();
    expect(indexer.getStatus().lastError).toBe("replay RPC failed");
    expect(await db.vaultEvents.count()).toBe(0);
    expect((await db.cursors.get(CURSOR))?.lastProcessedBlock).toBe(126);
    expect(indexer.getStatus().lastSyncedBlock).toBe(126);
  });

  it("rolls back both source replacements if the cursor write fails", async () => {
    const client = createMockPublicClient({
      blockNumber: 160n,
      logs: [vaultLog("DepositAdded", { depositId: 1, assets: 1n })]
    });
    setup(client);
    await indexer.syncOnce();
    const put = vi.spyOn(db.cursors, "put").mockRejectedValueOnce(new Error("disk full"));
    client.getBlockNumber.mockResolvedValue(170n);
    client.getLogs.mockResolvedValue([log("PlayerPayableCreated", { player: PLAYER, amount: 1n })]);
    await indexer.syncOnce();
    put.mockRestore();
    expect(indexer.getStatus().lastError).toBe("disk full");
    expect((await db.vaultEvents.toArray()).map((row) => row.eventName)).toEqual(["DepositAdded"]);
    expect(await db.bankEvents.count()).toBe(0);
    expect((await db.cursors.get(CURSOR))!.lastProcessedBlock).toBe(160);
  });

  it("coalesces overlapping refreshes", async () => {
    const client = createMockPublicClient({});
    setup(client);
    await Promise.all([indexer.syncOnce(), indexer.syncOnce()]);
    expect(client.getBlockNumber).toHaveBeenCalledTimes(1);
    expect(client.getLogs).toHaveBeenCalledTimes(2);
  });
});
