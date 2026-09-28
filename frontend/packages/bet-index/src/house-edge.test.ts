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
const otherHub = "0x00000000000000000000000000000000000000a5" as const;
const gameHub = "0x00000000000000000000000000000000000000a6" as const;
const finalizeTx = `0x${"f1".repeat(32)}` as const;

function event(
  gameHub: `0x${string}`,
  eventName: BetIndexEvent["eventName"],
  logIndex: number,
  args: Record<string, unknown>,
  block = 20n,
  txHash: `0x${string}` = finalizeTx
): BetIndexEvent {
  return { chainId, gameHub, blockNumber: block, txHash, logIndex, eventName, args };
}

const placed = (gameHub: `0x${string}`) =>
  event(
    gameHub,
    "BetPlaced",
    0,
    { positionId: 1n, player: "0x0000000000000000000000000000000000000077", stake: 1_000_000n },
    10n,
    `0x${"a1".repeat(32)}`
  );
// GameHub.finalize emits HouseEdgeAllocated right before BetFinalized.
const allocated = event(gameHub, "HouseEdgeAllocated", 3, {
  positionId: 1n,
  usedTurnover: 1_000_000n,
  effectiveHouseEdgeBps: 200,
  edge: 20_000n,
  operatorShare: 10_000n,
  lpRetained: 10_000n,
  protocolFee: 3_000n,
  r0: 2_000n,
  r1: 4_000n,
  r2: 1_000n,
  markup: 0n
});
const finalized = (gameHub: `0x${string}`) =>
  event(gameHub, "BetFinalized", 4, {
    positionId: 1n,
    payoutGross: 0n,
    payoutNet: 0n,
    refundAmount: 0n
  });
const expectedHouseEdge = {
  usedTurnover: "1000000",
  effectiveHouseEdgeBps: 200,
  edge: "20000",
  operatorShare: "10000",
  lpRetained: "10000",
  protocolFee: "3000",
  r0: "2000",
  r1: "4000",
  r2: "1000",
  markup: "0"
};

for (const backend of ["memory", "postgres"] as const) {
  describe.skipIf(backend === "postgres" && !url)(`${backend} house-edge allocation`, () => {
    let store: BetIndexStore;
    let admin: Sql | undefined;
    let sql: Sql | undefined;
    const schema = `house_edge_${randomUUID().replaceAll("-", "")}`;
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
        await store.initializeSchema();
      }
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

    it.each(["after", "before"])(
      "annotates a settled bet written %s its lifecycle without changing it",
      async (order) => {
        const lifecycle = [placed(gameHub), finalized(gameHub)];
        if (order === "after") {
          await store.writeGameHubEvents(lifecycle);
          // The keeper writes each event type in its own batch.
          expect(await store.writeGameHubEvents([allocated])).toEqual([]);
        } else {
          expect(await store.writeGameHubEvents([allocated])).toEqual([]);
          await store.writeGameHubEvents(lifecycle);
        }
        const bet = await store.getBet({ chainId, gameHub: gameHub, betId: 1n });
        expect(bet).toMatchObject({
          state: "finalized",
          lastEventName: "BetFinalized",
          stake: "1000000",
          houseEdge: expectedHouseEdge
        });
        expect((await store.getRecentBets({ chainId, limit: 10 }))[0]?.houseEdge).toEqual(
          expectedHouseEdge
        );
        expect(
          (
            await store.getPlayerBets({
              chainId,
              limit: 10,
              player: "0x0000000000000000000000000000000000000077"
            })
          )[0]?.houseEdge
        ).toEqual(expectedHouseEdge);
      }
    );

    it("keeps an allocation to the hub that emitted it", async () => {
      // Only one hub's bet 1 has an indexed allocation; never borrow it for the other hub.
      await store.writeGameHubEvents([placed(otherHub), finalized(otherHub)]);
      await store.writeGameHubEvents([placed(gameHub), allocated, finalized(gameHub)]);
      expect(
        (await store.getBet({ chainId, gameHub: otherHub, betId: 1n }))?.houseEdge
      ).toBeUndefined();
      expect((await store.getBet({ chainId, gameHub: gameHub, betId: 1n }))?.houseEdge).toEqual(
        expectedHouseEdge
      );
    });

    it("does not store an allocation passed with a bet row", async () => {
      await store.writeGameHubEvents([placed(otherHub)]);
      const row = await store.getBet({ chainId, gameHub: otherHub, betId: 1n });
      await store.writeBetRows([{ ...row!, houseEdge: expectedHouseEdge }]);
      expect(
        (await store.getBet({ chainId, gameHub: otherHub, betId: 1n }))?.houseEdge
      ).toBeUndefined();
    });
  });
}
