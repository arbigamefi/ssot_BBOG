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
const scope = { chainId: 8453, sportsHub: "0x0000000000000000000000000000000000000001" as const };
const other = { ...scope, sportsHub: "0x0000000000000000000000000000000000000002" as const };

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

  it("initializes concurrently and is idempotent after data exists", async () => {
    await first.sportsRecovery.enqueue({
      ...scope,
      marketId: 1n,
      requiredBlock: 150n,
      availableAt: 0
    });
    await Promise.all([first.initializeSchema(), second.initializeSchema()]);
    expect((await second.sportsRecovery.due(scope, 0, 10))[0]?.requiredBlock).toBe(150n);
  });

  it.each([0n, 100_000n])(
    "backfills terminal refund %s and retains it across connections and raw replay",
    async (refundAmount) => {
      const betId = refundAmount === 0n ? 901n : 902n;
      const event: BetIndexEvent = {
        chainId: 84532,
        gameHub: scope.sportsHub,
        eventName: "BetFinalized",
        blockNumber: 900n,
        txHash: `0x${betId.toString(16).padStart(64, "0")}`,
        logIndex: 1,
        args: { positionId: betId, payoutNet: 196_000n, payoutGross: 200_000n }
      };
      await first.writeGameHubEvents([event]);
      expect(
        (await second.getBet({ chainId: 84532, gameHub: scope.sportsHub, betId }))?.refundAmount
      ).toBeUndefined();
      await second.writeGameHubEvents([{ ...event, args: { ...event.args, refundAmount } }]);
      await first.writeGameHubEvents([event]);
      expect(
        await second.getBet({ chainId: 84532, gameHub: scope.sportsHub, betId })
      ).toMatchObject({
        payout: "196000",
        payoutGross: "200000",
        refundAmount: refundAmount.toString()
      });
    }
  );

  it("persists bounded cursors, work and numeric pages across connections without cross-talk", async () => {
    const input = [2n, 10n, 1n, 2n ** 255n].map((ticketId) => ({ marketId: 2n, ticketId }));
    await Promise.all([
      first.sportsRecovery.writeTickets(scope, input),
      second.sportsRecovery.writeTickets(scope, input)
    ]);
    await first.sportsRecovery.writeTickets(other, [{ marketId: 2n, ticketId: 99n }]);
    await first.setCursor({
      chainId: 8453,
      cursorKey: scope.sportsHub,
      source: "sports-tickets-v1:100",
      blockNumber: 109n
    });
    await first.sportsRecovery.enqueue({
      ...scope,
      marketId: 2n,
      requiredBlock: 109n,
      availableAt: 1
    });
    const [work] = (await second.sportsRecovery.due(scope, 1, 10)).filter((w) => w.marketId === 2n);
    const page = await second.sportsRecovery.ticketPage(scope, 2n, work!.ticketCursor, 2);
    expect(page).toEqual([1n, 2n]);
    await second.sportsRecovery.checkpoint(work!, {
      ticketCursor: 2n,
      availableAt: 2,
      attempts: 0
    });
    expect(await first.sportsRecovery.ticketPage(scope, 2n, 2n, 2)).toEqual([10n, 2n ** 255n]);
    expect(await second.sportsRecovery.ticketPage(other, 2n, 0n, 10)).toEqual([99n]);
    expect(await second.getCursor(8453, "sports-tickets-v1:100", scope.sportsHub)).toBe(109n);
    expect(await second.getCursor(8453, "sports-tickets-v1:100", other.sportsHub)).toBeNull();
    expect(await second.getCursor(84532, "sports-tickets-v1:100", scope.sportsHub)).toBeNull();
  });

  it("rejects stale page acknowledgements and delete/recreate ABA", async () => {
    const input = { ...scope, marketId: 3n, requiredBlock: 100n, availableAt: 0 };
    await first.sportsRecovery.enqueue(input);
    const [old] = (await second.sportsRecovery.due(scope, 0, 10)).filter((w) => w.marketId === 3n);
    const done = { complete: true, ticketCursor: 10n, availableAt: 0, attempts: 0 };
    await first.sportsRecovery.enqueue({ ...input, requiredBlock: 110n });
    await second.sportsRecovery.checkpoint(old!, done);
    const [newer] = (await first.sportsRecovery.due(scope, 0, 10)).filter((w) => w.marketId === 3n);
    expect(newer?.requiredBlock).toBe(110n);
    await first.sportsRecovery.checkpoint(newer!, done);
    await first.sportsRecovery.enqueue(input);
    await second.sportsRecovery.checkpoint(newer!, done);
    expect((await first.sportsRecovery.due(scope, 0, 10)).some((w) => w.marketId === 3n)).toBe(
      true
    );
  });

  it("rolls back a failed ticket batch before a coverage checkpoint and safely replays", async () => {
    await expect(
      first.sportsRecovery.writeTickets(scope, [
        { marketId: 4n, ticketId: 1n },
        { marketId: 4n, ticketId: 10n ** 80n }
      ])
    ).rejects.toThrow();
    expect(await second.sportsRecovery.ticketPage(scope, 4n, 0n, 10)).toEqual([]);
    await first.sportsRecovery.writeTickets(scope, [{ marketId: 4n, ticketId: 1n }]);
    await first.setCursor({
      chainId: 8453,
      cursorKey: scope.sportsHub,
      source: "sports-tickets-v1:4",
      blockNumber: 400n
    });
    expect(await second.sportsRecovery.ticketPage(scope, 4n, 0n, 10)).toEqual([1n]);
  });

  it("binds the page checkpoint to the widest coverage origin across workers", async () => {
    const input = {
      ...scope,
      marketId: 5n,
      requiredBlock: 500n,
      availableAt: 0,
      coverageStartBlock: 100n
    };
    await first.sportsRecovery.enqueue(input);
    const [work] = (await second.sportsRecovery.due(scope, 0, 20)).filter((w) => w.marketId === 5n);
    await second.sportsRecovery.checkpoint(work!, {
      ticketCursor: 200n,
      availableAt: 0,
      attempts: 0
    });
    await first.sportsRecovery.enqueue(input);
    expect(
      (await second.sportsRecovery.due(scope, 0, 20)).find((w) => w.marketId === 5n)?.ticketCursor
    ).toBe(200n);
    await first.sportsRecovery.enqueue({ ...input, coverageStartBlock: 50n });
    await second.sportsRecovery.enqueue(input);
    const updated = (await first.sportsRecovery.due(scope, 0, 20)).find((w) => w.marketId === 5n);
    expect(updated?.ticketCursor).toBe(0n);
    expect(updated?.coverageStartBlock).toBe(50n);
  });

  it("recovers casino IDs by chain and hub, pages numerically, and excludes terminal events", async () => {
    const ready = (
      id: bigint,
      n: number,
      gameHub: `0x${string}` = scope.sportsHub,
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
      ready(99n, 4, other.sportsHub)
    ]);
    await first.writeGameHubEvents([ready(2n, 5, scope.sportsHub, "BetFinalized")]);
    await first.setCursor({
      chainId: 8453,
      cursorKey: scope.sportsHub,
      source: "gamehub-events",
      blockNumber: 200n
    });
    const query = { chainId: 8453, gameHub: scope.sportsHub, afterBetId: 0n, limit: 1 };
    expect(await second.getRandomReadyBetIds(query)).toEqual([1n]);
    expect(await second.getRandomReadyBetIds({ ...query, afterBetId: 1n })).toEqual([10n]);
    expect(await second.getRandomReadyBetIds({ ...query, gameHub: other.sportsHub })).toEqual([
      99n
    ]);
    expect(await second.getRandomReadyBetIds({ ...query, chainId: 84532 })).toEqual([]);
  });

  it("recovers pending VRF across connections without duplicating ready bets or resurrecting terminal bets", async () => {
    const event = (
      id: bigint,
      eventName: BetIndexEvent["eventName"],
      index: number
    ): BetIndexEvent => ({
      chainId: 31337,
      gameHub: scope.sportsHub,
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
      { ...event(1n, "BetPlaced", 9), gameHub: other.sportsHub },
      { ...event(1n, "BetPlaced", 10), chainId: 31338 }
    ];
    await first.writeGameHubEvents(events);
    await second.writeGameHubEvents(events);
    const query = { chainId: 31337, gameHub: scope.sportsHub, afterBetId: 0n, limit: 2 };
    expect(await second.getUnresolvedBetIds(query)).toEqual([2n, 10n]);
    expect(await second.getUnresolvedBetIds({ ...query, afterBetId: 10n })).toEqual([2n ** 255n]);
    expect(await first.getRandomReadyBetIds(query)).toEqual([10n]);
    await first.writeGameHubEvents([event(2n, "BetRefunded", 11)]);
    expect(await second.getUnresolvedBetIds(query)).toEqual([10n, 2n ** 255n]);
  });

  it("binds provider cash flow to Bank identity across reused pool IDs and aliases", async () => {
    const row = {
      chainId: 31337,
      poolId: "1",
      owner: scope.sportsHub,
      bank: scope.sportsHub,
      asset: other.sportsHub,
      id: "unused",
      action: "withdraw" as const,
      assets: "10",
      shares: "10",
      txHash: "0xaa" as const,
      blockNumber: 20,
      logIndex: 1,
      updatedAt: 0
    };
    await first.writeBankProviderLedgerRows([
      row,
      { ...row, txHash: "0xbb", bank: other.sportsHub, blockNumber: 21, assets: "999" },
      { ...row, txHash: "0xcc", poolId: "9", blockNumber: 22, assets: "20" },
      { ...row, txHash: "0xdd", chainId: 31338, blockNumber: 23 }
    ]);
    const query = {
      chainId: 31337,
      owner: scope.sportsHub,
      bank: scope.sportsHub,
      limit: 10
    };
    expect((await second.getBankProviderLedger(query)).map((item) => item.assets)).toEqual([
      "20",
      "10"
    ]);
    expect(
      (await first.getBankProviderLedger({ ...query, beforeBlock: 22, beforeLogIndex: 1 })).map(
        (item) => item.assets
      )
    ).toEqual(["10"]);
  });
  it("replaces cash ranges atomically including empty reorg pages and retains attribution", async () => {
    const row = {
      chainId: 777,
      poolId: "1",
      owner: scope.sportsHub,
      bank: scope.sportsHub,
      asset: other.sportsHub,
      id: "ignored",
      action: "recovery" as const,
      assets: "8",
      shares: "0",
      txHash: "0x777a" as const,
      blockNumber: 20,
      logIndex: 1,
      updatedAt: 0,
      receiver: other.sportsHub,
      caller: scope.sportsHub,
      epochId: "7"
    };
    await first.writeBankProviderLedgerRows([
      row,
      { ...row, txHash: "0x777b", bank: other.sportsHub },
      { ...row, txHash: "0x777c", chainId: 778 }
    ]);
    const query = { chainId: 777, bank: scope.sportsHub, owner: scope.sportsHub, limit: 10 };
    await expect(
      first.replaceBankProviderLedgerRange({
        chainId: 777,
        bank: scope.sportsHub,
        fromBlock: 20n,
        toBlock: 20n,
        rows: [{ ...row, blockNumber: 21 }]
      })
    ).rejects.toThrow("outside replacement");
    expect(await second.getBankProviderLedger(query)).toMatchObject([
      { action: "recovery", receiver: other.sportsHub, caller: scope.sportsHub, epochId: "7" }
    ]);
    expect(await second.getBankProviderLedger({ ...query, endBlock: 19 })).toEqual([]);
    await first.replaceBankProviderLedgerRange({
      chainId: 777,
      bank: scope.sportsHub,
      fromBlock: 20n,
      toBlock: 20n,
      rows: []
    });
    expect(await second.getBankProviderLedger(query)).toEqual([]);
    expect(await second.getBankProviderLedger({ ...query, bank: other.sportsHub })).toHaveLength(1);
    expect(await second.getBankProviderLedger({ ...query, chainId: 778 })).toHaveLength(1);
    const range = {
      chainId: 777,
      bank: scope.sportsHub,
      fromBlock: 20n,
      toBlock: 20n,
      rows: [{ ...row, action: "donation" as const, receiver: scope.sportsHub }]
    };
    await first.replaceBankProviderLedgerRange(range);
    await second.replaceBankProviderLedgerRange(range);
    expect(await first.getBankProviderLedger(query)).toMatchObject([
      { action: "donation", epochId: "7", assets: "8" }
    ]);
  });
});
