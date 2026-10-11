import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPostgresBetIndexStoreFromSql,
  type BetIndexEvent,
  type BetIndexStore
} from "./index.js";

// Explicit local-only opt in. Every run owns a separate disposable schema.
const url = process.env.KEEPER_TEST_POSTGRES_URL;
if (url && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("KEEPER_TEST_POSTGRES_URL must target a local disposable PostgreSQL instance");
}
const HUB = "0x0000000000000000000000000000000000000001" as const;
const OTHER = "0x0000000000000000000000000000000000000002" as const;

describe.skipIf(!url)("PostgreSQL recovery integration", () => {
  const schema = `keeper_recovery_${randomUUID().replaceAll("-", "")}`;
  let admin: Sql;
  let sql1: Sql;
  let sql2: Sql;
  let first: BetIndexStore;
  let second: BetIndexStore;
  const connect = () =>
    postgres(url!, {
      transform: postgres.camel,
      onnotice: () => undefined,
      connection: { search_path: schema },
      max: 5
    });
  beforeAll(async () => {
    admin = postgres(url!, { onnotice: () => undefined });
    await admin.unsafe(`create schema "${schema}"`);
    sql1 = connect();
    sql2 = connect();
    first = createPostgresBetIndexStoreFromSql(sql1);
    second = createPostgresBetIndexStoreFromSql(sql2);
    // Fresh concurrent initialization must not deadlock or race CREATE.
    await Promise.all([
      first.initializeSchema(),
      second.initializeSchema(),
      first.initializeSchema(),
      second.initializeSchema()
    ]);
  });
  afterAll(async () => {
    await Promise.allSettled([sql1?.end(), sql2?.end()]);
    await admin?.unsafe(`drop schema if exists "${schema}" cascade`);
    await admin?.end();
  });

  it("initializes concurrently, stays idempotent after data exists and isolates cursors", async () => {
    await first.setCursor({
      chainId: 8453,
      cursorKey: HUB,
      source: "gamehub-events",
      blockNumber: 150n
    });
    await Promise.all([first.initializeSchema(), second.initializeSchema()]);
    expect(await second.getCursor(8453, "gamehub-events", HUB)).toBe(150n);
    expect(await second.getCursor(8453, "gamehub-events", OTHER)).toBeNull();
    expect(await second.getCursor(84532, "gamehub-events", HUB)).toBeNull();
  });

  it.each([0n, 100_000n])(
    "backfills terminal refund %s and retains it across connections and raw replay",
    async (refundAmount) => {
      const betId = refundAmount === 0n ? 901n : 902n;
      const event: BetIndexEvent = {
        chainId: 84532,
        gameHub: HUB,
        eventName: "BetFinalized",
        blockNumber: 900n,
        txHash: `0x${betId.toString(16).padStart(64, "0")}`,
        logIndex: 1,
        args: { positionId: betId, payoutNet: 196_000n, payoutGross: 200_000n }
      };
      await first.writeGameHubEvents([event]);
      expect(
        (await second.getBet({ chainId: 84532, gameHub: HUB, betId }))?.refundAmount
      ).toBeUndefined();
      await second.writeGameHubEvents([{ ...event, args: { ...event.args, refundAmount } }]);
      await first.writeGameHubEvents([event]);
      expect(await second.getBet({ chainId: 84532, gameHub: HUB, betId })).toMatchObject({
        payout: "196000",
        payoutGross: "200000",
        refundAmount: refundAmount.toString()
      });
    }
  );

  it("recovers casino IDs by chain and hub, pages numerically, and excludes terminal events", async () => {
    const ready = (
      id: bigint,
      n: number,
      gameHub: `0x${string}` = HUB,
      eventName: BetIndexEvent["eventName"] = "BetRandomReady"
    ): BetIndexEvent => ({
      chainId: 8453,
      gameHub,
      blockNumber: 100n,
      txHash: `0x${String(n).padStart(64, "0")}`,
      logIndex: 0,
      eventName,
      args: { betId: id }
    });
    await first.writeGameHubEvents([
      ready(1n, 1),
      ready(2n, 2),
      ready(10n, 3),
      ready(99n, 4, OTHER)
    ]);
    await first.writeGameHubEvents([ready(2n, 5, HUB, "BetFinalized")]);
    await first.setCursor({
      chainId: 8453,
      cursorKey: HUB,
      source: "gamehub-events",
      blockNumber: 200n
    });
    const query = { chainId: 8453, gameHub: HUB, afterBetId: 0n, limit: 1 };
    expect(await second.getRandomReadyBetIds(query)).toEqual([1n]);
    expect(await second.getRandomReadyBetIds({ ...query, afterBetId: 1n })).toEqual([10n]);
    expect(await second.getRandomReadyBetIds({ ...query, gameHub: OTHER })).toEqual([99n]);
    expect(await second.getRandomReadyBetIds({ ...query, chainId: 84532 })).toEqual([]);
  });

  it("recovers pending VRF across connections without duplicating ready bets or resurrecting terminal bets", async () => {
    const event = (
      id: bigint,
      eventName: BetIndexEvent["eventName"],
      index: number
    ): BetIndexEvent => ({
      chainId: 31337,
      gameHub: HUB,
      blockNumber: 100n,
      txHash: `0x${index.toString(16).padStart(64, "0")}`,
      logIndex: index,
      eventName,
      args: { betId: id }
    });
    const events = [
      event(2n, "BetPlaced", 1),
      event(10n, "BetPlaced", 2),
      event(10n, "BetRandomReady", 3),
      event(2n ** 255n, "BetPlaced", 4),
      event(3n, "BetPlaced", 5),
      event(3n, "BetRefunded", 6),
      event(4n, "BetPlaced", 7),
      event(4n, "BetFinalized", 8),
      { ...event(1n, "BetPlaced", 9), gameHub: OTHER },
      { ...event(1n, "BetPlaced", 10), chainId: 31338 }
    ];
    await first.writeGameHubEvents(events);
    await second.writeGameHubEvents(events);
    const query = { chainId: 31337, gameHub: HUB, afterBetId: 0n, limit: 2 };
    expect(await second.getUnresolvedBetIds(query)).toEqual([2n, 10n]);
    expect(await second.getUnresolvedBetIds({ ...query, afterBetId: 10n })).toEqual([2n ** 255n]);
    expect(await first.getRandomReadyBetIds(query)).toEqual([10n]);
    await first.writeGameHubEvents([event(2n, "BetRefunded", 11)]);
    expect(await second.getUnresolvedBetIds(query)).toEqual([10n, 2n ** 255n]);
  });

  it("binds provider cash flow to Vault identity across reused pool IDs and aliases", async () => {
    const row = {
      chainId: 31337,
      poolId: "1",
      owner: HUB,
      vault: HUB,
      bank: HUB,
      asset: OTHER,
      id: "unused",
      action: "withdraw" as const,
      assets: "10",
      depositId: "10",
      txHash: "0xaa" as const,
      blockNumber: 20,
      logIndex: 1,
      updatedAt: 0
    };
    await first.writeVaultProviderLedgerRows([
      row,
      { ...row, txHash: "0xbb", vault: OTHER, blockNumber: 21, assets: "999" },
      { ...row, txHash: "0xcc", poolId: "9", blockNumber: 22, assets: "20" },
      { ...row, txHash: "0xdd", chainId: 31338, blockNumber: 23 }
    ]);
    const query = {
      chainId: 31337,
      owner: HUB,
      vault: HUB,
      limit: 10
    };
    expect((await second.getVaultProviderLedger(query)).map((item) => item.assets)).toEqual([
      "20",
      "10"
    ]);
    expect(
      (await first.getVaultProviderLedger({ ...query, beforeBlock: 22, beforeLogIndex: 1 })).map(
        (item) => item.assets
      )
    ).toEqual(["10"]);
  });
  it("replaces cash ranges atomically including empty reorg pages and retains attribution", async () => {
    const row = {
      chainId: 777,
      poolId: "1",
      owner: HUB,
      vault: HUB,
      bank: HUB,
      asset: OTHER,
      id: "ignored",
      action: "withdraw" as const,
      assets: "8",
      depositId: "0",
      txHash: "0x777a" as const,
      blockNumber: 20,
      logIndex: 1,
      updatedAt: 0,
      receiver: OTHER,
      caller: HUB,
      withdrawAfter: "7"
    };
    await first.writeVaultProviderLedgerRows([
      row,
      { ...row, txHash: "0x777b", vault: OTHER },
      { ...row, txHash: "0x777c", chainId: 778 }
    ]);
    const query = { chainId: 777, vault: HUB, owner: HUB, limit: 10 };
    await expect(
      first.replaceVaultProviderLedgerRange({
        chainId: 777,
        vault: HUB,
        fromBlock: 20n,
        toBlock: 20n,
        rows: [{ ...row, blockNumber: 21 }]
      })
    ).rejects.toThrow("outside replacement");
    expect(await second.getVaultProviderLedger(query)).toMatchObject([
      { action: "withdraw", receiver: OTHER, caller: HUB, withdrawAfter: "7" }
    ]);
    expect(await second.getVaultProviderLedger({ ...query, endBlock: 19 })).toEqual([]);
    await first.replaceVaultProviderLedgerRange({
      chainId: 777,
      vault: HUB,
      fromBlock: 20n,
      toBlock: 20n,
      rows: []
    });
    expect(await second.getVaultProviderLedger(query)).toEqual([]);
    expect(await second.getVaultProviderLedger({ ...query, vault: OTHER })).toHaveLength(1);
    expect(await second.getVaultProviderLedger({ ...query, chainId: 778 })).toHaveLength(1);
    const range = {
      chainId: 777,
      vault: HUB,
      fromBlock: 20n,
      toBlock: 20n,
      rows: [{ ...row, action: "deposit" as const, receiver: HUB }]
    };
    await first.replaceVaultProviderLedgerRange(range);
    await second.replaceVaultProviderLedgerRange(range);
    expect(await first.getVaultProviderLedger(query)).toMatchObject([
      { action: "deposit", withdrawAfter: "7", assets: "8" }
    ]);
  });

  it("retains a gifted deposit in both payer and owner queries without duplicate cash", async () => {
    const row = {
      id: "ignored",
      chainId: 779,
      poolId: "1",
      bank: HUB,
      vault: HUB,
      asset: OTHER,
      owner: HUB,
      caller: OTHER,
      receiver: HUB,
      action: "deposit" as const,
      depositId: "1099511627776",
      assets: "100",
      txHash: "0x779a" as const,
      blockNumber: 20,
      logIndex: 1,
      updatedAt: 0
    };
    await first.writeVaultProviderLedgerRows([row, row]);
    const query = { chainId: 779, vault: HUB, limit: 10 };
    for (const owner of [HUB, OTHER]) {
      expect(await second.getVaultProviderLedger({ ...query, owner })).toMatchObject([
        { action: "deposit", owner: HUB, caller: OTHER, assets: "100" }
      ]);
    }
    expect(
      await second.getVaultProviderLedger({
        ...query,
        owner: OTHER,
        vault: OTHER
      })
    ).toEqual([]);
  });
});
