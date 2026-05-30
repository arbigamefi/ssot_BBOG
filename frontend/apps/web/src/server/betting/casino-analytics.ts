import { getAddress, type Address, type Hex } from "viem";
import { createPostgresBetIndexStore, type BetIndexStore } from "@ssot/bet-index";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

const DEFAULT_LEADERBOARD_LIMIT = 10;
const MAX_LEADERBOARD_LIMIT = 50;
export type CasinoLeaderboardSort = "turnover" | "topWin";

let durableBetIndexStore: BetIndexStore | null | undefined;

type PrimaryAsset = {
  address: Address;
  decimals: number;
  symbol: string;
};

export type CasinoStatsResponse = {
  schemaVersion: 1;
  chainId: number;
  generatedAt: number;
  source: "postgres" | "unavailable";
  asset: PrimaryAsset;
  stats: {
    betCount: number;
    settledCount: number;
    wonCount: number;
    uniquePlayers: number;
    turnover: string;
    payout: string;
    payoutGross: string;
  };
  games: Array<{
    gameId: Hex;
    slug: string;
    label: string;
    betCount: number;
    settledCount: number;
    wonCount: number;
    uniquePlayers: number;
    turnover: string;
    payout: string;
    payoutGross: string;
  }>;
};

export type CasinoLeaderboardResponse = {
  schemaVersion: 1;
  chainId: number;
  generatedAt: number;
  source: "postgres" | "unavailable";
  by: CasinoLeaderboardSort;
  /** Present when the leaderboard is scoped to a single game. */
  gameId: Hex | null;
  asset: PrimaryAsset;
  rows: Array<{
    rank: number;
    player: Address;
    betCount?: number;
    settledCount?: number;
    turnover?: string;
    betId?: string;
    gameId?: Hex;
    stake?: string;
    payout: string;
    payoutGross: string;
    multiplierPpm?: string;
  }>;
};

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isTruthyEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}

function isFalseyEnv(value: string | undefined) {
  return ["0", "false", "no", "off"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}

function getDurableBetIndexStore() {
  if (durableBetIndexStore !== undefined) return durableBetIndexStore;
  const connectionString = cleanEnvValue(process.env.BET_INDEX_DATABASE_URL);
  if (!connectionString || isFalseyEnv(process.env.BET_INDEX_READ_ENABLED)) {
    durableBetIndexStore = null;
    return durableBetIndexStore;
  }
  durableBetIndexStore = createPostgresBetIndexStore({
    connectionString,
    ssl: isTruthyEnv(process.env.BET_INDEX_SSL)
  });
  return durableBetIndexStore;
}

function resolvePrimaryAsset(chainId: number): {
  asset: PrimaryAsset;
  games: Array<{ gameId: Hex; label: string; slug: string }>;
} {
  const releaseResult = loadEmbeddedRelease(chainId);
  if (!releaseResult.ok) throw new Error(releaseResult.error);
  const asset = releaseResult.release.assets[0];
  if (!asset) throw new Error(`No release asset configured for chainId=${chainId}.`);
  return {
    asset: {
      address: getAddress(asset.address) as Address,
      decimals: asset.decimals,
      symbol: asset.symbol
    },
    games: releaseResult.release.gamesMeta.map((game) => ({
      gameId: game.gameId as Hex,
      label: game.label,
      slug: game.slug
    }))
  };
}

function emptyStatsResponse({
  asset,
  chainId,
  games,
  generatedAt,
  source
}: {
  asset: PrimaryAsset;
  chainId: number;
  games: Array<{ gameId: Hex; label: string; slug: string }>;
  generatedAt: number;
  source: CasinoStatsResponse["source"];
}): CasinoStatsResponse {
  return {
    asset,
    chainId,
    games: games.map((game) => ({
      ...game,
      betCount: 0,
      payout: "0",
      payoutGross: "0",
      settledCount: 0,
      wonCount: 0,
      turnover: "0",
      uniquePlayers: 0
    })),
    generatedAt,
    schemaVersion: 1,
    source,
    stats: {
      betCount: 0,
      payout: "0",
      payoutGross: "0",
      settledCount: 0,
      wonCount: 0,
      turnover: "0",
      uniquePlayers: 0
    }
  };
}

export function clampCasinoLeaderboardLimit(limit: number | undefined) {
  if (!Number.isFinite(limit) || !limit || limit <= 0) return DEFAULT_LEADERBOARD_LIMIT;
  return Math.min(MAX_LEADERBOARD_LIMIT, Math.max(1, Math.floor(limit)));
}

export async function queryCasinoStats({
  chainId,
  now = Date.now
}: {
  chainId: number;
  now?: () => number;
}): Promise<CasinoStatsResponse> {
  const { asset, games } = resolvePrimaryAsset(chainId);
  const generatedAt = now();
  const store = getDurableBetIndexStore();
  if (!store) {
    return emptyStatsResponse({ asset, chainId, games, generatedAt, source: "unavailable" });
  }

  try {
    const [stats, volumes] = await Promise.all([
      store.getCasinoStats({ asset: asset.address, chainId }),
      store.getGameVolumes({ asset: asset.address, chainId })
    ]);
    const byGame = new Map(volumes.map((row) => [row.gameId.toLowerCase(), row]));
    return {
      asset,
      chainId,
      games: games.map((game) => {
        const volume = byGame.get(game.gameId.toLowerCase());
        return {
          ...game,
          betCount: volume?.betCount ?? 0,
          payout: volume?.payout ?? "0",
          payoutGross: volume?.payoutGross ?? "0",
          settledCount: volume?.settledCount ?? 0,
          wonCount: volume?.wonCount ?? 0,
          turnover: volume?.turnover ?? "0",
          uniquePlayers: volume?.uniquePlayers ?? 0
        };
      }),
      generatedAt,
      schemaVersion: 1,
      source: "postgres",
      stats: {
        betCount: stats.betCount,
        payout: stats.payout,
        payoutGross: stats.payoutGross,
        settledCount: stats.settledCount,
        wonCount: stats.wonCount,
        turnover: stats.turnover,
        uniquePlayers: stats.uniquePlayers
      }
    };
  } catch {
    return emptyStatsResponse({ asset, chainId, games, generatedAt, source: "unavailable" });
  }
}

export async function queryCasinoLeaderboard({
  chainId,
  limit,
  gameId,
  by = "turnover",
  now = Date.now
}: {
  chainId: number;
  limit: number;
  gameId?: Hex;
  by?: CasinoLeaderboardSort;
  now?: () => number;
}): Promise<CasinoLeaderboardResponse> {
  const { asset } = resolvePrimaryAsset(chainId);
  const generatedAt = now();
  const normalizedGameId = (gameId?.toLowerCase() as Hex | undefined) ?? null;
  const store = getDurableBetIndexStore();
  if (!store) {
    return {
      asset,
      by,
      chainId,
      gameId: normalizedGameId,
      generatedAt,
      rows: [],
      schemaVersion: 1,
      source: "unavailable"
    };
  }

  try {
    const rows =
      by === "topWin"
        ? await store.getCasinoTopWins({
            asset: asset.address,
            chainId,
            limit,
            ...(gameId ? { gameId } : {})
          })
        : await store.getCasinoLeaderboard({
            asset: asset.address,
            chainId,
            limit,
            ...(gameId ? { gameId } : {})
          });
    return {
      asset,
      by,
      chainId,
      gameId: normalizedGameId,
      generatedAt,
      rows: rows.map((row, index) =>
        by === "topWin"
          ? {
              betId: "betId" in row ? row.betId : undefined,
              gameId: "gameId" in row ? row.gameId : undefined,
              multiplierPpm: "multiplierPpm" in row ? row.multiplierPpm : undefined,
              payout: row.payout,
              payoutGross: row.payoutGross,
              player: getAddress(row.player) as Address,
              rank: index + 1,
              stake: "stake" in row ? row.stake : undefined
            }
          : {
              betCount: "betCount" in row ? row.betCount : undefined,
              payout: row.payout,
              payoutGross: row.payoutGross,
              player: getAddress(row.player) as Address,
              rank: index + 1,
              settledCount: "settledCount" in row ? row.settledCount : undefined,
              turnover: "turnover" in row ? row.turnover : undefined
            }
      ),
      schemaVersion: 1,
      source: "postgres"
    };
  } catch {
    return {
      asset,
      by,
      chainId,
      gameId: normalizedGameId,
      generatedAt,
      rows: [],
      schemaVersion: 1,
      source: "unavailable"
    };
  }
}
