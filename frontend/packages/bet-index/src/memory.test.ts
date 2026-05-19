import { describe, expect, it } from "vitest";

import { createMemoryBetIndexStore } from "./index";

const GAME_ID = `0x${"11".repeat(32)}` as const;
const PLAYER = "0x2222222222222222222222222222222222222222" as const;
const AFFILIATE = "0x5555555555555555555555555555555555555555" as const;
const GAME_HUB = "0x3333333333333333333333333333333333333333" as const;
const SPORTS_HUB = "0x6666666666666666666666666666666666666666" as const;

describe("memory bet index store", () => {
  it("folds gamehub events and queries recent/player rows", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: {
          asset: "0x4444444444444444444444444444444444444444",
          gameId: GAME_ID,
          player: PLAYER,
          pricingAffiliate: AFFILIATE,
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
    const affiliate = await store.getAffiliateBets({
      affiliate: AFFILIATE,
      chainId: 84532,
      limit: 10
    });
    const affiliateStats = await store.getAffiliateStats({
      affiliate: AFFILIATE,
      chainId: 84532
    });

    expect(recent).toHaveLength(1);
    expect(player).toHaveLength(1);
    expect(affiliate).toHaveLength(1);
    expect(player[0]).toMatchObject({
      betId: "7",
      gameId: GAME_ID,
      player: PLAYER,
      pricingAffiliate: AFFILIATE,
      payout: "19",
      payoutGross: "20",
      stake: "10",
      finalizedTxHash: "0xbbb",
      terminalTxHash: "0xbbb",
      state: "finalized",
      updatedBlock: 12
    });
    expect(affiliateStats).toMatchObject({
      affiliate: AFFILIATE,
      betCount: 1,
      payout: "19",
      payoutGross: "20",
      settledCount: 1,
      turnover: "10"
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

  it("folds sport ticket events and queries player rows", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeSportsHubEvents([
      {
        args: {
          eventId: 1001n,
          marketId: 6n,
          oddsSnapshotHash: `0x${"77".repeat(32)}`,
          outcomeId: 2,
          payout: 55_000000n,
          player: PLAYER,
          poolId: 1n,
          positionId: 22n,
          reserved: 45_000000n,
          rulebookHash: `0x${"88".repeat(32)}`,
          stake: 10_000000n,
          ticketId: 12n
        },
        blockNumber: 30n,
        chainId: 84532,
        eventName: "TicketPlaced",
        logIndex: 1,
        sportsHub: SPORTS_HUB,
        txHash: "0xeee"
      },
      {
        args: {
          payout: 55_000000n,
          positionId: 22n,
          ticketId: 12n
        },
        blockNumber: 40n,
        chainId: 84532,
        eventName: "TicketSettled",
        logIndex: 2,
        sportsHub: SPORTS_HUB,
        txHash: "0xfff"
      }
    ]);

    const tickets = await store.getPlayerSportsTickets({
      chainId: 84532,
      limit: 10,
      player: PLAYER
    });

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      eventId: "1001",
      marketId: "6",
      outcomeId: 2,
      payout: "55000000",
      player: PLAYER,
      positionId: "22",
      stake: "10000000",
      state: "settled",
      ticketId: "12",
      terminalTxHash: "0xfff",
      updatedBlock: 40
    });
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
