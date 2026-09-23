import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createMemoryBetIndexStore,
  createPostgresBetIndexStoreFromSql,
  type BetIndexStore,
  type BetRow
} from "./index.js";

const url = process.env.KEEPER_TEST_POSTGRES_URL;
if (url && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("KEEPER_TEST_POSTGRES_URL must target a local disposable PostgreSQL instance");
}
const asset = "0x4444444444444444444444444444444444444444" as const;
const affiliate = "0x5555555555555555555555555555555555555555" as const;
const gameId = `0x${"11".repeat(32)}` as const;
const chainId = 84532;
const scope = { asset, chainId };
function row(betId: number, override: Partial<BetRow> = {}): BetRow {
  return {
    id: `${chainId}:${betId}`,
    chainId,
    betId: String(betId),
    asset,
    gameId,
    player: `0x${betId.toString().padStart(40, "0")}`,
    pricingAffiliate: affiliate,
    state: "finalized",
    stake: "200000",
    payout: "196000",
    payoutGross: "200000",
    refundAmount: "0",
    updatedAt: Date.now(),
    placedAt: Date.now(),
    updatedBlock: betId,
    lastEventName: "BetFinalized",
    lastTxHash: `0x${betId.toString().padStart(64, "0")}`,
    ...override
  };
}

for (const backend of ["memory", "postgres"] as const) {
  describe.skipIf(backend === "postgres" && !url)(`${backend} refund financial conformance`, () => {
    let store: BetIndexStore;
    let admin: Sql | undefined;
    let sql: Sql | undefined;
    const schema = `financial_${randomUUID().replaceAll("-", "")}`;
    beforeAll(async () => {
      if (backend === "postgres") {
        admin = postgres(url!, { onnotice: () => undefined });
        await admin.unsafe(`create schema "${schema}"`);
        sql = postgres(url!, {
          transform: postgres.camel,
          onnotice: () => undefined,
          connection: { search_path: schema }
        });
        store = createPostgresBetIndexStoreFromSql(sql);
        await store.migrate();
      }
    });
    beforeEach(async () => {
      if (backend === "memory") store = createMemoryBetIndexStore();
      else await sql!`truncate bets`;
    });
    afterAll(async () => {
      await sql?.end();
      await admin?.unsafe(`drop schema if exists "${schema}" cascade`);
      await admin?.end();
    });

    it("reconciles partial win/loss, ordinary loss, full refund and pending stakes in every aggregate", async () => {
      await store.writeBetRows([
        row(1, { refundAmount: "100000" }),
        row(2, { refundAmount: "100000", payout: "0", payoutGross: "0" }),
        row(3),
        row(4, { state: "refunded", payout: "200000", refundAmount: "200000" }),
        row(5, {
          state: "placed",
          payout: undefined,
          payoutGross: undefined,
          refundAmount: undefined
        })
      ]);
      const totals = {
        betCount: 5,
        settledCount: 4,
        turnover: "400000",
        payout: "392000",
        payoutGross: "400000"
      };
      expect(await store.getCasinoStats(scope)).toMatchObject({
        ...totals,
        wonCount: 1,
        uniquePlayers: 5
      });
      expect(await store.getAffiliateStats({ ...scope, affiliate })).toMatchObject(totals);
      expect(await store.getGameVolumes(scope)).toMatchObject([{ ...totals, gameId, wonCount: 1 }]);
      expect(await store.getCasinoTimeseries({ ...scope, days: 7 })).toMatchObject([
        { ...totals, wonCount: 1 }
      ]);
      const board = await store.getCasinoLeaderboard({ ...scope, limit: 10 });
      expect(board.map((r) => r.turnover)).toEqual(["200000", "100000", "100000", "0", "0"]);
      expect(await store.getCasinoPlayerRank({ ...scope, player: row(3).player! })).toMatchObject({
        rank: 1,
        turnover: "200000"
      });
      expect(await store.getCasinoTopWins({ ...scope, limit: 10 })).toMatchObject([
        { betId: "1", stake: "100000", payout: "196000", multiplierPpm: "1960000" }
      ]);
      // House/game award less consumed stake agrees with all individual player net amounts.
      expect(BigInt(totals.payout) - BigInt(totals.turnover)).toBe(-8000n);
    });

    it.each([undefined, "", "-1", "200001"])(
      "withholds monetary aggregates for unproven refund %s and recovers after enrichment",
      async (refundAmount) => {
        const incomplete = row(1, { refundAmount });
        await store.writeBetRows([incomplete]);
        const queries = [
          () => store.getCasinoStats(scope),
          () => store.getAffiliateStats({ ...scope, affiliate }),
          () => store.getGameVolumes(scope),
          () => store.getCasinoTimeseries({ ...scope, days: 7 }),
          () => store.getCasinoLeaderboard({ ...scope, limit: 10 }),
          () => store.getCasinoTopWins({ ...scope, limit: 10 }),
          () => store.getCasinoPlayerRank({ ...scope, player: incomplete.player! })
        ];
        for (const query of queries) await expect(query()).rejects.toThrow();
        await store.writeBetRows([{ ...incomplete, refundAmount: "100000", updatedBlock: 2 }]);
        expect(await store.getCasinoStats(scope)).toMatchObject({
          turnover: "100000",
          payout: "196000",
          wonCount: 1
        });
      }
    );
  });
}
