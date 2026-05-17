import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRecentBetsCache,
  clampRecentBetsLimit,
  clampPlayerBetsLimit,
  foldRecentBetLogs,
  normalizeGameId,
  normalizePlayerAddress,
  queryRecentBets,
  queryPlayerBets
} from "./recent-bets";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

const GAME_ID = `0x${"11".repeat(32)}` as const;
const PLAYER = "0x2222222222222222222222222222222222222222" as const;
const GAME_HUB = "0x3333333333333333333333333333333333333333" as const;

function latestBlockAfterEmbeddedRelease(windowBlocks: bigint) {
  const release = loadEmbeddedRelease(84532);
  if (!release.ok) throw new Error(release.error);
  return BigInt(release.release.meta?.blockNumber ?? 0) + 2n + windowBlocks;
}

const ENV_KEYS = [
  "BET_INDEX_READ_ENABLED",
  "PLAYER_BETS_LOG_CHUNK_BLOCKS",
  "PLAYER_BETS_WINDOW_BLOCKS",
  "RECENT_BETS_LOG_CHUNK_BLOCKS",
  "RECENT_BETS_WINDOW_BLOCKS"
];

describe("recent bets server aggregation", () => {
  const envSnapshot = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      envSnapshot.set(key, process.env[key]);
    }
    clearRecentBetsCache();
  });

  afterEach(() => {
    for (const [key, value] of envSnapshot.entries()) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    envSnapshot.clear();
    clearRecentBetsCache();
    vi.restoreAllMocks();
  });

  it("normalizes and validates game ids", () => {
    expect(normalizeGameId(GAME_ID.toUpperCase())).toBe(GAME_ID);
    expect(() => normalizeGameId("0x1234")).toThrow("gameId");
  });

  it("clamps product-facing limits", () => {
    expect(clampRecentBetsLimit(undefined)).toBe(20);
    expect(clampRecentBetsLimit(0)).toBe(20);
    expect(clampRecentBetsLimit(3.8)).toBe(3);
    expect(clampRecentBetsLimit(500)).toBe(50);
    expect(clampPlayerBetsLimit(undefined)).toBe(100);
    expect(clampPlayerBetsLimit(500)).toBe(500);
    expect(clampPlayerBetsLimit(999)).toBe(500);
  });

  it("normalizes and validates player addresses", () => {
    expect(normalizePlayerAddress(PLAYER)).toBe(PLAYER);
    expect(() => normalizePlayerAddress("0x1234")).toThrow("player");
  });

  it("folds GameHub logs into terminal recent bet rows", () => {
    const rows = foldRecentBetLogs({
      chainId: 84532,
      gameHub: GAME_HUB,
      logs: [
        {
          args: {
            positionId: 7n,
            payoutGross: 20n,
            payoutNet: 19n
          },
          blockNumber: 12n,
          eventName: "BetFinalized",
          logIndex: 3,
          transactionHash: "0xccc"
        },
        {
          args: {
            asset: "0x4444444444444444444444444444444444444444",
            gameId: GAME_ID,
            player: PLAYER,
            positionId: 7n
          },
          blockNumber: 10n,
          eventName: "BetPlaced",
          logIndex: 1,
          transactionHash: "0xaaa"
        },
        {
          args: {
            positionId: 7n,
            randomHash: `0x${"55".repeat(32)}`,
            requestId: 99n
          },
          blockNumber: 11n,
          eventName: "BetRandomReady",
          logIndex: 2,
          transactionHash: "0xbbb"
        }
      ]
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      betId: "7",
      chainId: 84532,
      gameId: GAME_ID,
      lastEventName: "BetFinalized",
      lastTxHash: "0xccc",
      player: PLAYER,
      state: "finalized",
      updatedBlock: 12
    });
  });

  it("chunks recent fallback log scans for free-tier RPC providers", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.RECENT_BETS_WINDOW_BLOCKS = "25";
    process.env.RECENT_BETS_LOG_CHUNK_BLOCKS = "10";

    const getLogs = vi.fn().mockResolvedValue([]);
    const response = await queryRecentBets({
      chainId: 84532,
      client: {
        getBlockNumber: vi.fn().mockResolvedValue(latestBlockAfterEmbeddedRelease(25n)),
        getLogs
      } as any,
      limit: 10,
      now: () => 1234
    });

    expect(response.source).toBe("rpc-window");
    expect(response.rows).toHaveLength(0);
    expect(getLogs).toHaveBeenCalledTimes(12);
    for (const call of getLogs.mock.calls) {
      const params = call[0] as { fromBlock: bigint; toBlock: bigint };
      expect(params.toBlock - params.fromBlock + 1n).toBeLessThanOrEqual(10n);
    }
  });

  it("returns an empty best-effort recent feed when RPC fallback is unavailable", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";

    const response = await queryRecentBets({
      chainId: 84532,
      client: {
        getBlockNumber: vi.fn().mockResolvedValue(latestBlockAfterEmbeddedRelease(25n)),
        getLogs: vi.fn().mockRejectedValue(new Error("rate limited"))
      } as any,
      limit: 10,
      now: () => 1234
    });

    expect(response).toMatchObject({
      chainId: 84532,
      fromBlock: 0,
      rows: [],
      source: "rpc-window",
      toBlock: 0
    });
  });

  it("queries player placed logs and folds matching terminal events", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.PLAYER_BETS_WINDOW_BLOCKS = "9";
    process.env.PLAYER_BETS_LOG_CHUNK_BLOCKS = "10";

    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([
        {
          args: {
            asset: "0x4444444444444444444444444444444444444444",
            gameId: GAME_ID,
            player: PLAYER,
            positionId: 8n
          },
          blockNumber: 20n,
          logIndex: 1,
          transactionHash: "0xaaa"
        }
      ])
      .mockResolvedValueOnce([
        {
          args: {
            positionId: 8n,
            randomHash: `0x${"55".repeat(32)}`,
            requestId: 99n
          },
          blockNumber: 21n,
          logIndex: 2,
          transactionHash: "0xbbb"
        },
        {
          args: { positionId: 9n, requestId: 100n },
          blockNumber: 21n,
          logIndex: 3,
          transactionHash: "0xddd"
        }
      ])
      .mockResolvedValueOnce([
        {
          args: {
            positionId: 8n,
            payoutGross: 20n,
            payoutNet: 19n
          },
          blockNumber: 22n,
          logIndex: 4,
          transactionHash: "0xccc"
        }
      ])
      .mockResolvedValueOnce([]);

    const response = await queryPlayerBets({
      chainId: 84532,
      client: {
        getBlockNumber: vi.fn().mockResolvedValue(latestBlockAfterEmbeddedRelease(9n)),
        getLogs
      } as any,
      limit: 10,
      now: () => 1234,
      player: PLAYER
    });

    expect(response.player).toBe(PLAYER);
    expect(response.rows).toHaveLength(1);
    expect(response.rows[0]).toMatchObject({
      betId: "8",
      lastEventName: "BetFinalized",
      player: PLAYER,
      state: "finalized"
    });
  });
});
