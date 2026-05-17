import { describe, expect, it } from "vitest";

import { clampRecentBetsLimit, foldRecentBetLogs, normalizeGameId } from "./recent-bets";

const GAME_ID = `0x${"11".repeat(32)}` as const;
const PLAYER = "0x2222222222222222222222222222222222222222" as const;
const GAME_HUB = "0x3333333333333333333333333333333333333333" as const;

describe("recent bets server aggregation", () => {
  it("normalizes and validates game ids", () => {
    expect(normalizeGameId(GAME_ID.toUpperCase())).toBe(GAME_ID);
    expect(() => normalizeGameId("0x1234")).toThrow("gameId");
  });

  it("clamps product-facing limits", () => {
    expect(clampRecentBetsLimit(undefined)).toBe(20);
    expect(clampRecentBetsLimit(0)).toBe(20);
    expect(clampRecentBetsLimit(3.8)).toBe(3);
    expect(clampRecentBetsLimit(500)).toBe(50);
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
});
