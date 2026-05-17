import { describe, expect, it } from "vitest";

import { createMemoryBetIndexStore } from "./index";

const GAME_ID = `0x${"11".repeat(32)}` as const;
const PLAYER = "0x2222222222222222222222222222222222222222" as const;
const GAME_HUB = "0x3333333333333333333333333333333333333333" as const;

describe("memory bet index store", () => {
  it("folds gamehub events and queries recent/player rows", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: {
          asset: "0x4444444444444444444444444444444444444444",
          gameId: GAME_ID,
          player: PLAYER,
          positionId: 7n,
          requestId: 77n,
          stake: 10n
        },
        blockNumber: 10n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 1,
        txHash: "0xaaa"
      },
      {
        args: {
          payoutGross: 20n,
          payoutNet: 19n,
          positionId: 7n
        },
        blockNumber: 12n,
        chainId: 84532,
        eventName: "BetFinalized",
        gameHub: GAME_HUB,
        logIndex: 2,
        txHash: "0xbbb"
      }
    ]);

    const recent = await store.getRecentBets({ chainId: 84532, limit: 10 });
    const player = await store.getPlayerBets({ chainId: 84532, limit: 10, player: PLAYER });

    expect(recent).toHaveLength(1);
    expect(player).toHaveLength(1);
    expect(player[0]).toMatchObject({
      betId: "7",
      gameId: GAME_ID,
      player: PLAYER,
      payout: "19",
      payoutGross: "20",
      stake: "10",
      finalizedTxHash: "0xbbb",
      terminalTxHash: "0xbbb",
      state: "finalized",
      updatedBlock: 12
    });
  });

  it("stores replay cursors independently from bet rows", async () => {
    const store = createMemoryBetIndexStore();
    await store.setCursor({
      blockNumber: 123n,
      chainId: 84532,
      cursorKey: GAME_HUB,
      source: "gamehub-events"
    });

    await expect(store.getCursor(84532, "gamehub-events", GAME_HUB)).resolves.toBe(123n);
  });

  it("preserves placed metadata when lifecycle events arrive in later writes", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: {
          asset: "0x4444444444444444444444444444444444444444",
          gameId: GAME_ID,
          player: PLAYER,
          positionId: 9n,
          stake: 10n
        },
        blockNumber: 20n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 1,
        txHash: "0xccc"
      }
    ]);

    await store.writeGameHubEvents([
      {
        args: {
          payoutGross: 0n,
          payoutNet: 0n,
          positionId: 9n
        },
        blockNumber: 25n,
        chainId: 84532,
        eventName: "BetFinalized",
        gameHub: GAME_HUB,
        logIndex: 2,
        txHash: "0xddd"
      }
    ]);

    const player = await store.getPlayerBets({ chainId: 84532, limit: 10, player: PLAYER });
    expect(player[0]).toMatchObject({
      betId: "9",
      gameId: GAME_ID,
      payout: "0",
      player: PLAYER,
      stake: "10",
      state: "finalized",
      updatedBlock: 25
    });
  });
});
