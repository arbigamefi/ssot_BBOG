import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createMemoryBetIndexStore,
  createPostgresBetIndexStoreFromSql,
  type BetIndexEvent,
  type BetIndexStore
} from "./index.js";

const url = process.env.KEEPER_TEST_POSTGRES_URL;
if (url && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("KEEPER_TEST_POSTGRES_URL must target a local disposable PostgreSQL instance");
}

const chainId = 84532;
const gameHub = "0x00000000000000000000000000000000000000a6" as const;
const otherHub = "0x00000000000000000000000000000000000000a7" as const;
const asset = "0x4444444444444444444444444444444444444444" as const;
const player = "0x0000000000000000000000000000000000000077" as const;
const bank = "0x00000000000000000000000000000000000000B1" as const;
const caller = "0x00000000000000000000000000000000000000Ca" as const;
const gameId = `0x${"11".repeat(32)}` as const;
const errorPrefix = `0x${"ab".repeat(4)}${"00".repeat(28)}` as const;

const tx = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;

function event(
  eventName: BetIndexEvent["eventName"],
  args: Record<string, unknown>,
  block: bigint,
  logIndex: number,
  txHash: `0x${string}` = tx(Number(block)),
  hub: `0x${string}` = gameHub
): BetIndexEvent {
  return {
    chainId,
    gameHub: hub,
    blockNumber: block,
    blockTimestamp: Number(block) * 1000,
    txHash,
    logIndex,
    eventName,
    args
  };
}

const placed = (positionId: bigint, block: bigint, stake = 1_000_000n) =>
  event("BetPlaced", { positionId, gameId, player, asset, stake, requestId: positionId }, block, 0);
const ready = (positionId: bigint, block: bigint, logIndex = 1) =>
  event(
    "BetRandomReady",
    { positionId, requestId: positionId, randomHash: `0x${"cd".repeat(32)}` },
    block,
    logIndex
  );
const voided = (positionId: bigint, block: bigint, stake = 1_000_000n, logIndex = 5) =>
  event(
    "BetVoided",
    { positionId, caller, stake, settlementErrorPrefix: errorPrefix },
    block,
    logIndex
  );
const finalized = (positionId: bigint, block: bigint, logIndex = 5) =>
  event(
    "BetFinalized",
    {
      positionId,
      payoutGross: 2_000_000n,
      payoutNet: 1_960_000n,
      feeOnPayout: 40_000n,
      protocolFeeAccrual: 0n,
      refundAmount: 0n
    },
    block,
    logIndex
  );

for (const backend of ["memory", "postgres"] as const) {
  describe.skipIf(backend === "postgres" && !url)(`${backend} void indexing`, () => {
    let store: BetIndexStore;
    let admin: Sql | undefined;
    let sql: Sql | undefined;
    const schema = `void_${randomUUID().replaceAll("-", "")}`;
    beforeAll(async () => {
      if (backend !== "postgres") return;
      admin = postgres(url!, { onnotice: () => undefined });
      await admin.unsafe(`create schema "${schema}"`);
      sql = postgres(url!, {
        transform: postgres.camel,
        onnotice: () => undefined,
        connection: { search_path: schema }
      });
      store = createPostgresBetIndexStoreFromSql(sql);
      await store.initializeSchema();
    });
    beforeEach(async () => {
      if (backend === "memory") store = createMemoryBetIndexStore();
      else await sql!`truncate bets, gamehub_events`;
    });
    afterAll(async () => {
      await sql?.end();
      await admin?.unsafe(`drop schema if exists "${schema}" cascade`);
      await admin?.end();
    });

    it("ends a bet as voided: stake refunded as payable, no payout, caller and error prefix kept", async () => {
      await store.writeGameHubEvents([placed(1n, 10n), ready(1n, 12n)]);
      await store.writeGameHubEvents([voided(1n, 20n)]);
      expect(await store.getBet({ chainId, gameHub, betId: 1n })).toMatchObject({
        state: "voided",
        stake: "1000000",
        refundAmount: "1000000",
        payout: "0",
        payoutGross: "0",
        voidedTxHash: tx(20),
        terminalTxHash: tx(20),
        voidCaller: caller.toLowerCase(),
        voidSettlementErrorPrefix: errorPrefix,
        lastEventName: "BetVoided",
        updatedBlock: 20
      });
      const row = await store.getBet({ chainId, gameHub, betId: 1n });
      expect(row?.finalizedTxHash).toBeUndefined();
      expect(row?.refundedTxHash).toBeUndefined();
    });

    it.each([
      ["BetVoided", voided(1n, 20n), "voided"],
      ["BetFinalized", finalized(1n, 20n), "finalized"]
    ] as const)(
      "keeps a %s terminal state when the same block's ready event is written afterwards",
      async (eventName, terminal, state) => {
        await store.writeGameHubEvents([placed(1n, 10n)]);
        // voidBet on a PendingVRF bet records the random first, so one receipt carries both events.
        await store.writeGameHubEvents([ready(1n, 20n), terminal]);
        // A separate watcher writes the ready event again after the scan wrote the terminal batch.
        await store.writeGameHubEvents([ready(1n, 20n)]);
        expect(await store.getBet({ chainId, gameHub, betId: 1n })).toMatchObject({
          state,
          lastEventName: eventName,
          lastTxHash: tx(20),
          updatedBlock: 20
        });
      }
    );

    it("builds the voided row from the void event alone when placement arrives later", async () => {
      await store.writeGameHubEvents([voided(2n, 20n, 3_000_000n)]);
      await store.writeGameHubEvents([placed(2n, 10n, 3_000_000n)]);
      expect(await store.getBet({ chainId, gameHub, betId: 2n })).toMatchObject({
        state: "voided",
        stake: "3000000",
        refundAmount: "3000000",
        player,
        placedBlock: 10,
        lastEventName: "BetVoided",
        updatedBlock: 20
      });
    });

    it("excludes voided bets from pending and ready recovery", async () => {
      await store.writeGameHubEvents([
        placed(1n, 10n),
        ready(1n, 12n),
        placed(2n, 13n),
        ready(2n, 14n),
        placed(3n, 15n)
      ]);
      await store.writeGameHubEvents([voided(1n, 20n)]);
      const query = { chainId, gameHub, afterBetId: 0n, limit: 10 };
      expect(await store.getUnresolvedBetIds(query)).toEqual([2n, 3n]);
      expect(await store.getRandomReadyBetIds(query)).toEqual([2n]);
    });

    it("counts a void as settled with neither turnover nor award in every aggregate", async () => {
      // The finalized event carries the terminal-getter refund, as the keeper writes it.
      await store.writeGameHubEvents([
        placed(1n, 10n),
        finalized(1n, 11n),
        placed(2n, 12n),
        ready(2n, 13n),
        voided(2n, 20n)
      ]);
      const scope = { asset, chainId, gameHub };
      const totals = { betCount: 2, settledCount: 2, turnover: "1000000", payout: "1960000" };
      expect(await store.getCasinoStats(scope)).toMatchObject({ ...totals, wonCount: 1 });
      expect(await store.getGameVolumes(scope)).toMatchObject([{ ...totals, gameId }]);
      expect(await store.getCasinoLeaderboard({ ...scope, limit: 10 })).toMatchObject([
        { player, ...totals }
      ]);
      expect(await store.getCasinoPlayerRank({ ...scope, player })).toMatchObject({
        rank: 1,
        betCount: 2,
        turnover: "1000000"
      });
      expect(await store.getCasinoTopWins({ ...scope, limit: 10 })).toMatchObject([
        { betId: "1", stake: "1000000", payout: "1960000" }
      ]);
    });

    it("withholds aggregates while a voided row has no stake to refund", async () => {
      await store.writeBetRows([
        {
          id: `${chainId}:${gameHub}:9`,
          chainId,
          gameHub,
          betId: "9",
          asset,
          player,
          state: "voided",
          payout: "0",
          updatedAt: 1_000,
          updatedBlock: 9,
          lastEventName: "BetVoided",
          lastTxHash: tx(9)
        }
      ]);
      await expect(store.getCasinoStats({ asset, chainId, gameHub })).rejects.toThrow();
    });

    it("lists VoidWindowOpened and GameDisabled newest first without creating bets", async () => {
      await store.writeGameHubEvents([
        event("VoidWindowOpened", { poolId: 1n, bank, cohortEnd: 1_700_000_000n, caller }, 30n, 2),
        event("GameDisabled", { gameId, caller }, 31n, 0),
        event("VoidWindowOpened", { poolId: 1n, bank, cohortEnd: 1_700_000_500n, caller }, 32n, 1),
        event(
          "GameDisabled",
          { gameId, caller },
          33n,
          0,
          tx(99),
          otherHub // another GameHub deployment
        )
      ]);
      const events = await store.getGameHubOperatorEvents({ chainId, gameHub, limit: 10 });
      expect(events).toEqual([
        {
          eventName: "VoidWindowOpened",
          chainId,
          gameHub,
          blockNumber: 32,
          blockTimestamp: 32_000,
          txHash: tx(32),
          logIndex: 1,
          caller: caller.toLowerCase(),
          poolId: "1",
          bank: bank.toLowerCase(),
          cohortEnd: "1700000500"
        },
        {
          eventName: "GameDisabled",
          chainId,
          gameHub,
          blockNumber: 31,
          blockTimestamp: 31_000,
          txHash: tx(31),
          logIndex: 0,
          caller: caller.toLowerCase(),
          gameId
        },
        expect.objectContaining({ eventName: "VoidWindowOpened", cohortEnd: "1700000000" })
      ]);
      expect(
        await store.getGameHubOperatorEvents({
          chainId,
          gameHub,
          limit: 1,
          eventName: "VoidWindowOpened"
        })
      ).toMatchObject([{ blockNumber: 32 }]);
      expect(await store.getGameHubOperatorEvents({ chainId: 1, gameHub, limit: 10 })).toEqual([]);
      expect(await store.getRecentBets({ chainId, limit: 10 })).toEqual([]);
      expect(
        await store.getUnresolvedBetIds({ chainId, gameHub, afterBetId: 0n, limit: 10 })
      ).toEqual([]);
    });
  });
}
