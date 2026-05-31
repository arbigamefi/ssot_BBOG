import { describe, expect, it } from "vitest";

import { createMemoryBetIndexStore } from "./index";

const GAME_ID = `0x${"11".repeat(32)}` as const;
const GAME_ID_TWO = `0x${"22".repeat(32)}` as const;
const PLAYER = "0x2222222222222222222222222222222222222222" as const;
const PLAYER_TWO = "0x8888888888888888888888888888888888888888" as const;
const AFFILIATE = "0x5555555555555555555555555555555555555555" as const;
const GAME_HUB = "0x3333333333333333333333333333333333333333" as const;
const ASSET = "0x4444444444444444444444444444444444444444" as const;
const SPORTS_HUB = "0x6666666666666666666666666666666666666666" as const;

describe("memory bet index store", () => {
  it("folds gamehub events and queries recent/player rows", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: {
          asset: ASSET,
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
    const heldTicketIds = await store.getHeldSportsTicketIdsByMarket({
      chainId: 84532,
      limit: 10,
      marketId: "6"
    });

    expect(tickets).toHaveLength(1);
    expect(heldTicketIds).toEqual([]);
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

  it("queries held sports ticket ids by market", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeSportsHubEvents([
      {
        args: {
          eventId: 1001n,
          marketId: 6n,
          outcomeId: 0,
          player: PLAYER,
          positionId: 22n,
          stake: 1_000000n,
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
          eventId: 1002n,
          marketId: 7n,
          outcomeId: 1,
          player: PLAYER,
          positionId: 23n,
          stake: 1_000000n,
          ticketId: 13n
        },
        blockNumber: 31n,
        chainId: 84532,
        eventName: "TicketPlaced",
        logIndex: 2,
        sportsHub: SPORTS_HUB,
        txHash: "0xeef"
      }
    ]);

    await expect(
      store.getHeldSportsTicketIdsByMarket({ chainId: 84532, limit: 10, marketId: "6" })
    ).resolves.toEqual([12n]);
  });

  it("preserves placed metadata when lifecycle events arrive in later writes", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: {
          asset: ASSET,
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

  it("aggregates asset-scoped casino stats, leaderboard, and game volumes", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: {
          asset: ASSET,
          gameId: GAME_ID,
          player: PLAYER,
          positionId: 1n,
          stake: 10n
        },
        blockNumber: 10n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 1,
        txHash: "0xa01"
      },
      {
        args: {
          payoutGross: 20n,
          payoutNet: 19n,
          positionId: 1n
        },
        blockNumber: 11n,
        chainId: 84532,
        eventName: "BetFinalized",
        gameHub: GAME_HUB,
        logIndex: 2,
        txHash: "0xa02"
      },
      {
        args: {
          asset: ASSET,
          gameId: GAME_ID,
          player: PLAYER_TWO,
          positionId: 2n,
          stake: 30n
        },
        blockNumber: 12n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 3,
        txHash: "0xa03"
      },
      {
        args: {
          asset: "0x9999999999999999999999999999999999999999",
          gameId: GAME_ID,
          player: PLAYER,
          positionId: 3n,
          stake: 100n
        },
        blockNumber: 13n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 4,
        txHash: "0xa04"
      }
    ]);

    await expect(store.getCasinoStats({ asset: ASSET, chainId: 84532 })).resolves.toMatchObject({
      asset: ASSET,
      betCount: 2,
      payout: "19",
      payoutGross: "20",
      settledCount: 1,
      wonCount: 1,
      turnover: "40",
      uniquePlayers: 2
    });

    await expect(
      store.getCasinoLeaderboard({ asset: ASSET, chainId: 84532, limit: 10 })
    ).resolves.toMatchObject([
      {
        asset: ASSET,
        player: PLAYER_TWO,
        betCount: 1,
        turnover: "30"
      },
      {
        asset: ASSET,
        player: PLAYER,
        betCount: 1,
        turnover: "10"
      }
    ]);

    await expect(store.getGameVolumes({ asset: ASSET, chainId: 84532 })).resolves.toMatchObject([
      {
        asset: ASSET,
        gameId: GAME_ID,
        betCount: 2,
        turnover: "40",
        uniquePlayers: 2
      }
    ]);
  });

  it("scopes the leaderboard to a single game and counts unique players per game", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: { asset: ASSET, gameId: GAME_ID, player: PLAYER, positionId: 1n, stake: 10n },
        blockNumber: 10n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 1,
        txHash: "0xb01"
      },
      {
        args: { asset: ASSET, gameId: GAME_ID_TWO, player: PLAYER_TWO, positionId: 2n, stake: 30n },
        blockNumber: 11n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 2,
        txHash: "0xb02"
      }
    ]);

    // Per-game leaderboard only ranks players within that game.
    const gameOne = await store.getCasinoLeaderboard({
      asset: ASSET,
      chainId: 84532,
      limit: 10,
      gameId: GAME_ID
    });
    expect(gameOne).toHaveLength(1);
    expect(gameOne[0]).toMatchObject({ player: PLAYER, turnover: "10" });

    const gameTwo = await store.getCasinoLeaderboard({
      asset: ASSET,
      chainId: 84532,
      limit: 10,
      gameId: GAME_ID_TWO
    });
    expect(gameTwo).toHaveLength(1);
    expect(gameTwo[0]).toMatchObject({ player: PLAYER_TWO, turnover: "30" });

    // Without a gameId the leaderboard spans every game.
    const allGames = await store.getCasinoLeaderboard({ asset: ASSET, chainId: 84532, limit: 10 });
    expect(allGames).toHaveLength(2);

    // Per-game volumes carry a unique-player count.
    const volumes = await store.getGameVolumes({ asset: ASSET, chainId: 84532 });
    expect(volumes).toHaveLength(2);
    for (const volume of volumes) {
      expect(volume.uniquePlayers).toBe(1);
    }
  });

  it("filters casino aggregates by a since lower bound on placement time", async () => {
    const store = createMemoryBetIndexStore();
    const dayMs = 24 * 60 * 60 * 1000;
    const old = Date.now() - 10 * dayMs;
    const recent = Date.now() - 1 * dayMs;

    await store.writeGameHubEvents([
      {
        args: { asset: ASSET, gameId: GAME_ID, player: PLAYER, positionId: 1n, stake: 10n },
        blockNumber: 10n,
        blockTimestamp: old,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 1,
        txHash: "0xe01"
      },
      {
        args: { asset: ASSET, gameId: GAME_ID_TWO, player: PLAYER_TWO, positionId: 2n, stake: 30n },
        blockNumber: 11n,
        blockTimestamp: recent,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 2,
        txHash: "0xe02"
      }
    ]);

    const since = Math.floor((Date.now() - 5 * dayMs) / 1000);

    // Windowed stats only see the recent bet; all-time sees both.
    await expect(
      store.getCasinoStats({ asset: ASSET, chainId: 84532, since })
    ).resolves.toMatchObject({ betCount: 1, turnover: "30", uniquePlayers: 1 });
    await expect(store.getCasinoStats({ asset: ASSET, chainId: 84532 })).resolves.toMatchObject({
      betCount: 2,
      turnover: "40"
    });

    // Windowed leaderboard only ranks the recent player.
    const windowedBoard = await store.getCasinoLeaderboard({
      asset: ASSET,
      chainId: 84532,
      limit: 10,
      since
    });
    expect(windowedBoard).toHaveLength(1);
    expect(windowedBoard[0]).toMatchObject({ player: PLAYER_TWO, turnover: "30" });

    // Windowed game volumes only include the recent game.
    const windowedVolumes = await store.getGameVolumes({ asset: ASSET, chainId: 84532, since });
    expect(windowedVolumes).toHaveLength(1);
    expect(windowedVolumes[0]).toMatchObject({ gameId: GAME_ID_TWO, turnover: "30" });
  });

  it("resolves a single player's turnover rank, or null when unranked", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: { asset: ASSET, gameId: GAME_ID, player: PLAYER, positionId: 1n, stake: 10n },
        blockNumber: 10n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 1,
        txHash: "0xf01"
      },
      {
        args: { asset: ASSET, gameId: GAME_ID, player: PLAYER_TWO, positionId: 2n, stake: 30n },
        blockNumber: 11n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 2,
        txHash: "0xf02"
      }
    ]);

    // PLAYER_TWO leads by turnover (30 > 10) → rank 1; PLAYER is rank 2.
    await expect(
      store.getCasinoPlayerRank({ asset: ASSET, chainId: 84532, player: PLAYER_TWO })
    ).resolves.toMatchObject({ player: PLAYER_TWO, rank: 1, turnover: "30", betCount: 1 });
    await expect(
      store.getCasinoPlayerRank({ asset: ASSET, chainId: 84532, player: PLAYER })
    ).resolves.toMatchObject({ player: PLAYER, rank: 2, turnover: "10" });

    // A wallet with no bets in scope is unranked.
    await expect(
      store.getCasinoPlayerRank({
        asset: ASSET,
        chainId: 84532,
        player: "0xdddd000000000000000000000000000000000099"
      })
    ).resolves.toBeNull();

    // Per-game scope: PLAYER_TWO only bet GAME_ID, so they are unranked in GAME_ID_TWO.
    await expect(
      store.getCasinoPlayerRank({
        asset: ASSET,
        chainId: 84532,
        gameId: GAME_ID_TWO,
        player: PLAYER_TWO
      })
    ).resolves.toBeNull();
    // ...but rank 1 within GAME_ID.
    await expect(
      store.getCasinoPlayerRank({
        asset: ASSET,
        chainId: 84532,
        gameId: GAME_ID,
        player: PLAYER_TWO
      })
    ).resolves.toMatchObject({ rank: 1 });
  });

  it("ranks durable top wins by multiplier with optional game scope", async () => {
    const store = createMemoryBetIndexStore();

    await store.writeGameHubEvents([
      {
        args: { asset: ASSET, gameId: GAME_ID, player: PLAYER, positionId: 1n, stake: 10n },
        blockNumber: 10n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 1,
        txHash: "0xc01"
      },
      {
        args: { payoutGross: 30n, payoutNet: 30n, positionId: 1n },
        blockNumber: 11n,
        chainId: 84532,
        eventName: "BetFinalized",
        gameHub: GAME_HUB,
        logIndex: 2,
        txHash: "0xc02"
      },
      {
        args: { asset: ASSET, gameId: GAME_ID, player: PLAYER_TWO, positionId: 2n, stake: 5n },
        blockNumber: 12n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 3,
        txHash: "0xc03"
      },
      {
        args: { payoutGross: 25n, payoutNet: 25n, positionId: 2n },
        blockNumber: 13n,
        chainId: 84532,
        eventName: "BetFinalized",
        gameHub: GAME_HUB,
        logIndex: 4,
        txHash: "0xc04"
      },
      {
        args: { asset: ASSET, gameId: GAME_ID_TWO, player: PLAYER, positionId: 3n, stake: 5n },
        blockNumber: 14n,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 5,
        txHash: "0xc05"
      },
      {
        args: { payoutGross: 0n, payoutNet: 0n, positionId: 3n },
        blockNumber: 15n,
        chainId: 84532,
        eventName: "BetFinalized",
        gameHub: GAME_HUB,
        logIndex: 6,
        txHash: "0xc06"
      }
    ]);

    const allGames = await store.getCasinoTopWins({ asset: ASSET, chainId: 84532, limit: 10 });
    expect(allGames).toHaveLength(2);
    expect(allGames[0]).toMatchObject({
      betId: "2",
      multiplierPpm: "5000000",
      payout: "25",
      player: PLAYER_TWO,
      stake: "5"
    });
    expect(allGames[1]).toMatchObject({ betId: "1", multiplierPpm: "3000000" });

    const gameTwo = await store.getCasinoTopWins({
      asset: ASSET,
      chainId: 84532,
      gameId: GAME_ID_TWO,
      limit: 10
    });
    expect(gameTwo).toHaveLength(0);
  });

  it("groups casino timeseries by chain placement date and asset", async () => {
    const store = createMemoryBetIndexStore();
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const today = Date.now();
    const yesterdayDate = new Date(yesterday).toISOString().slice(0, 10);
    const todayDate = new Date(today).toISOString().slice(0, 10);
    const otherAsset = "0x9999999999999999999999999999999999999999" as const;

    await store.writeGameHubEvents([
      {
        args: { asset: ASSET, gameId: GAME_ID, player: PLAYER, positionId: 1n, stake: 10n },
        blockNumber: 10n,
        blockTimestamp: yesterday,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 1,
        txHash: "0xd01"
      },
      {
        args: { payoutGross: 20n, payoutNet: 19n, positionId: 1n },
        blockNumber: 11n,
        blockTimestamp: today,
        chainId: 84532,
        eventName: "BetFinalized",
        gameHub: GAME_HUB,
        logIndex: 2,
        txHash: "0xd02"
      },
      {
        args: { asset: ASSET, gameId: GAME_ID, player: PLAYER_TWO, positionId: 2n, stake: 30n },
        blockNumber: 12n,
        blockTimestamp: today,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 3,
        txHash: "0xd03"
      },
      {
        args: { asset: ASSET, gameId: GAME_ID_TWO, player: PLAYER_TWO, positionId: 4n, stake: 40n },
        blockNumber: 14n,
        blockTimestamp: today,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 5,
        txHash: "0xd05"
      },
      {
        args: { asset: otherAsset, gameId: GAME_ID, player: PLAYER, positionId: 3n, stake: 100n },
        blockNumber: 15n,
        blockTimestamp: today,
        chainId: 84532,
        eventName: "BetPlaced",
        gameHub: GAME_HUB,
        logIndex: 6,
        txHash: "0xd04"
      }
    ]);

    const points = await store.getCasinoTimeseries({ asset: ASSET, chainId: 84532, days: 7 });
    expect(points.map((point) => point.date)).toEqual([yesterdayDate, todayDate]);
    expect(points[0]).toMatchObject({
      asset: ASSET,
      betCount: 1,
      date: yesterdayDate,
      payout: "19",
      settledCount: 1,
      turnover: "10",
      uniquePlayers: 1,
      wonCount: 1
    });
    expect(points[1]).toMatchObject({
      asset: ASSET,
      betCount: 2,
      date: todayDate,
      turnover: "70",
      uniquePlayers: 1
    });

    const gameOnePoints = await store.getCasinoTimeseries({
      asset: ASSET,
      chainId: 84532,
      days: 7,
      gameId: GAME_ID
    });
    expect(gameOnePoints.map((point) => point.turnover)).toEqual(["10", "30"]);
  });
});
