// @vitest-environment node
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyGameHubEventToBet,
  createGameHubIndexer,
  SSOTDb,
  type BetRow,
  type GameHubEventName
} from "@ssot/ssot/indexer";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

const durable = vi.hoisted(() => ({ rows: [] as BetRow[] }));

vi.mock("@ssot/bet-index", () => ({
  createPostgresBetIndexStore: () => ({ getPlayerBets: async () => durable.rows })
}));

vi.mock("@ssot/ssot/release", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ssot/ssot/release")>();
  const { default: fixture } =
    await import("../../../../../packages/ssot/src/fixtures/release-v16.fixture.json");
  return {
    ...actual,
    loadEmbeddedRelease: (chainId: number) => ({
      ok: true,
      release: { ...fixture, chainId, meta: { ...fixture.meta, blockNumber: 100 } }
    })
  };
});

import { clearRecentBetsCache, queryPlayerBets } from "../../server/betting/recent-bets";
import { mergeBetRows, readLocalPlayerBets } from "./usePlayerBets";

const CHAIN_ID = 84532;
const A = "0x00000000000000000000000000000000000000a1";
const B = "0x00000000000000000000000000000000000000b2";

function release() {
  const result = loadEmbeddedRelease(CHAIN_ID);
  if (!result.ok) throw new Error(result.error);
  return result.release;
}

function log(eventName: GameHubEventName, block: bigint, betId: bigint, args = {}) {
  return {
    eventName,
    blockNumber: block,
    logIndex: 0,
    transactionHash: `0x${block.toString(16).padStart(64, "0")}` as const,
    args: { positionId: betId, ...args } as Record<string, unknown>
  };
}

// Five blocks a second. A fresh browser's first range starts 3,600 seconds before the target 99,880, at 81,880;
// both bets were placed at second 12,000 and refunded at 19,880, after the one-hour refund timeout.
const PLACED_A = log("BetPlaced", 60_000n, 7n, { player: A, stake: 100n });
const REFUNDED_A = log("BetRefunded", 99_400n, 7n, { refundAmount: 100n });
const LOGS = [
  PLACED_A,
  log("BetPlaced", 60_001n, 8n, { player: B, stake: 100n }),
  REFUNDED_A,
  log("BetRefunded", 99_405n, 8n, { refundAmount: 100n })
];

/** getLogs answers the query's range, events, bet and player; getBet gives the bet's placement second. */
function chain(head = 100_000n) {
  return {
    getBlock: vi.fn(async (args?: { blockNumber?: bigint }) => {
      const number = args?.blockNumber ?? head;
      return { number, timestamp: number / 5n };
    }),
    getLogs: vi.fn(async (q: any) => {
      const names = (q.events ?? [q.event]).map((event: { name: string }) => event.name);
      return LOGS.filter(
        (l) =>
          l.blockNumber >= q.fromBlock &&
          l.blockNumber <= q.toBlock &&
          names.includes(l.eventName) &&
          (q.args?.positionId == null || q.args.positionId === l.args.positionId) &&
          (q.args?.player == null ||
            q.args.player.toLowerCase() === String(l.args.player).toLowerCase())
      );
    }),
    readContract: vi.fn(async (q: any) => {
      const placed = LOGS.find(
        (l) => l.eventName === "BetPlaced" && l.args.positionId === q.args[0]
      );
      return { placedAt: placed ? placed.blockNumber / 5n : 0n };
    })
  } as any;
}

/** The bet index's row after the given events. */
function indexRow(events: ReturnType<typeof log>[]) {
  return events.reduce<BetRow | undefined>(
    (row, l) =>
      applyGameHubEventToBet(row, {
        chainId: CHAIN_ID,
        gameHub: release().contracts.gameHub as `0x${string}`,
        blockNumber: Number(l.blockNumber),
        logIndex: l.logIndex,
        txHash: l.transactionHash,
        eventName: l.eventName,
        args: l.args
      }),
    undefined
  )!;
}

afterEach(() => {
  vi.unstubAllEnvs();
  clearRecentBetsCache();
  durable.rows = [];
});

describe("a fresh browser's list of a player's bets (2026-11-03 review A1)", () => {
  it.each(["healthy", "stale", "unavailable"] as const)(
    "shows a refund of a bet placed before its first range with the server index %s",
    async (server) => {
      const client = chain();
      const db = new SSOTDb(`player-bets-${server}-${Date.now()}`);
      try {
        const indexer = createGameHubIndexer({ release: release(), publicClient: client, db });
        await indexer.syncOnce();
        expect(indexer.getStatus().lastError).toBeUndefined();
        expect(client.getLogs.mock.calls[0][0].fromBlock).toBe(81_880n);

        vi.stubEnv("PLAYER_BETS_RPC_FALLBACK_ENABLED", "true");
        if (server === "unavailable") {
          vi.stubEnv("BET_INDEX_READ_ENABLED", "false");
          vi.stubEnv("BET_INDEX_DATABASE_URL", "");
        } else {
          vi.stubEnv("BET_INDEX_READ_ENABLED", "true");
          vi.stubEnv("BET_INDEX_DATABASE_URL", "postgres://index.invalid/bets");
          durable.rows = [indexRow(server === "healthy" ? [PLACED_A, REFUNDED_A] : [PLACED_A])];
        }
        const response = await queryPlayerBets({ chainId: CHAIN_ID, player: A, client });
        // The server's view: the refund, the placement only, or nothing in its RPC window.
        expect(response.rows.map((row) => row.state)).toEqual(
          server === "healthy" ? ["refunded"] : server === "stale" ? ["placed"] : []
        );

        const local = await readLocalPlayerBets({ db, chainId: CHAIN_ID, player: A, limit: 50 });
        const rows = mergeBetRows(response.rows, local, 50);
        expect(rows.map((row) => [row.betId, row.player?.toLowerCase(), row.state])).toEqual([
          ["7", A, "refunded"]
        ]);
        // The other player's refund in the same range stays theirs.
        const theirs = await readLocalPlayerBets({ db, chainId: CHAIN_ID, player: B, limit: 50 });
        expect(theirs.map((row) => [row.betId, row.state])).toEqual([["8", "refunded"]]);
      } finally {
        await db.delete();
      }
    }
  );
});

describe("an existing browser's missing-player rows (2026-11-03 review A1-R1)", () => {
  it.each(["healthy", "stale", "unavailable"] as const)(
    "repairs persisted terminal rows without new events with the server index %s",
    async (server) => {
      const name = `player-bets-upgrade-${server}-${crypto.randomUUID()}`;
      let db = new SSOTDb(name);
      const orphanA = indexRow([REFUNDED_A]);
      const orphanB = indexRow([LOGS[3]!]);
      const otherHub: BetRow = { ...orphanA, id: `${CHAIN_ID}:9`, betId: "9", gameHub: B };
      const otherChain = { ...orphanA, id: "8453:7", chainId: 8453 };
      const cursor = {
        id: `${CHAIN_ID}:${release().contracts.gameHub}`,
        chainId: CHAIN_ID,
        source: release().contracts.gameHub as `0x${string}`,
        lastProcessedBlock: 99_880,
        updatedAt: 1
      };
      const journal = {
        id: `${CHAIN_ID}:${REFUNDED_A.transactionHash}`,
        chainId: CHAIN_ID,
        txHash: REFUNDED_A.transactionHash,
        releaseDigest: release().releaseDigest,
        action: "withdraw",
        status: "mined" as const,
        ok: true,
        createdAt: 1
      };
      try {
        // Persist the exact old reducer's refund-only shape, close, then reopen the same release's database.
        await db.bets.bulkPut([orphanA, orphanB, otherHub, otherChain]);
        await db.cursors.put(cursor);
        await db.txJournal.put(journal);
        db.close();
        db = new SSOTDb(name);
        const client = chain(100_100n);
        const indexer = createGameHubIndexer({ release: release(), publicClient: client, db });
        await indexer.syncOnce();
        expect(indexer.getStatus().lastError).toBeUndefined();
        // Only the player changes: no terminal state, amount or receipt is replaced by the placement.
        expect(await db.bets.get(orphanA.id)).toEqual({ ...orphanA, player: A });
        expect(await db.bets.get(orphanB.id)).toEqual({ ...orphanB, player: B });
        expect(await db.bets.get(otherHub.id)).toEqual(otherHub);
        expect(await db.bets.get(otherChain.id)).toEqual(otherChain);
        expect(await db.txJournal.toArray()).toEqual([journal]);
        const scans = client.getLogs.mock.calls.filter(([q]: any[]) => q.events);
        expect(scans[0]![0].fromBlock).toBeGreaterThan(REFUNDED_A.blockNumber);
        expect(client.readContract).toHaveBeenCalledTimes(2);
        expect(await db.gameHubEvents.count()).toBe(0);

        vi.stubEnv("PLAYER_BETS_RPC_FALLBACK_ENABLED", "true");
        vi.stubEnv("BET_INDEX_READ_ENABLED", server === "unavailable" ? "false" : "true");
        vi.stubEnv(
          "BET_INDEX_DATABASE_URL",
          server === "unavailable" ? "" : "postgres://index.invalid/bets"
        );
        durable.rows = [indexRow(server === "healthy" ? [PLACED_A, REFUNDED_A] : [PLACED_A])];
        const response = await queryPlayerBets({ chainId: CHAIN_ID, player: A, client });
        const local = await readLocalPlayerBets({ db, chainId: CHAIN_ID, player: A, limit: 50 });
        expect(
          mergeBetRows(response.rows, local, 50).map((row) => [row.betId, row.player, row.state])
        ).toEqual([["7", A, "refunded"]]);
        const theirs = await readLocalPlayerBets({ db, chainId: CHAIN_ID, player: B, limit: 50 });
        expect(theirs.map((row) => [row.betId, row.state])).toEqual([["8", "refunded"]]);
        await indexer.syncOnce();
        expect(client.readContract).toHaveBeenCalledTimes(2);
      } finally {
        await db.delete();
      }
    }
  );

  it.each(["refunded", "finalized", "voided"] as const)(
    "retries a failed player lookup without changing the %s row or cursor",
    async (state) => {
      const db = new SSOTDb(`player-bets-retry-${state}-${crypto.randomUUID()}`);
      const orphan = { ...indexRow([REFUNDED_A]), state };
      const cursor = {
        id: `${CHAIN_ID}:${release().contracts.gameHub}`,
        chainId: CHAIN_ID,
        source: release().contracts.gameHub as `0x${string}`,
        lastProcessedBlock: 99_880,
        updatedAt: 1
      };
      try {
        await db.bets.put(orphan);
        await db.cursors.put(cursor);
        const client = chain(100_100n);
        client.readContract.mockRejectedValueOnce(new Error("placement temporarily unavailable"));
        const indexer = createGameHubIndexer({ release: release(), publicClient: client, db });
        await indexer.syncOnce();
        expect(indexer.getStatus().lastError).toBe("placement temporarily unavailable");
        expect(await db.bets.get(orphan.id)).toEqual(orphan);
        expect(await db.cursors.get(cursor.id)).toEqual(cursor);
        expect(client.getLogs).not.toHaveBeenCalled();
        await indexer.syncOnce();
        expect(indexer.getStatus().lastError).toBeUndefined();
        expect(await db.bets.get(orphan.id)).toEqual({ ...orphan, player: A });
        expect((await db.cursors.get(cursor.id))?.lastProcessedBlock).toBe(99_980);
      } finally {
        await db.delete();
      }
    }
  );
});
