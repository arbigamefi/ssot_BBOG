import type { PlaceBetInput } from "@ssot/ssot";
import { encodeStakeSpec } from "@ssot/ssot/encoding";

import type { GameMeta } from "./model";
import {
  buildGameParams,
  type CoinSide,
  type GameParamsHex,
  type GameParamsMessages
} from "./params";

type ReleaseAsset = {
  symbol?: string;
  address?: string;
  decimals?: number;
};

type ReleasePool = {
  poolId: number;
  domain?: string;
  domainId?: number;
  active?: boolean;
  asset?: string;
  bank?: string;
  symbol?: string;
  decimals?: number;
};

export type GameRoomRelease = {
  chainId: number;
  assets: readonly ReleaseAsset[];
  pools: readonly ReleasePool[];
};

export type BuildGamePlaceBetInputArgs = {
  release: GameRoomRelease;
  game: GameMeta;
  betAmount: number;
  betCount: number;
  stopGain: number;
  stopLoss: number;
  diceTarget: number;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  maxHouseEdgeBps?: number;
  messages?: GamePlaceBetMessages;
};

export type BuildGamePlaceBetInputResult =
  | { ok: true; input: PlaceBetInput; params: GameParamsHex }
  | { ok: false; message: string };

export type GamePlaceBetMessages = GameParamsMessages & {
  noActiveCasinoPool?: string;
};

function toUnits(amount: number, decimals: number) {
  return BigInt(Math.floor(Math.max(0, amount))) * BigInt(Math.pow(10, decimals));
}

export function findUSDCAsset(assets: readonly ReleaseAsset[]) {
  return assets.find((asset) => asset.symbol === "USDC");
}

export function findCasinoPool(pools: readonly ReleasePool[]) {
  return (
    pools.find((pool) => pool.active !== false && String(pool.domain).toLowerCase() === "casino") ??
    pools.find((pool) => pool.active !== false && pool.domainId === 1) ??
    pools.find((pool) => pool.active !== false)
  );
}

export function buildGamePlaceBetInput({
  release,
  game,
  betAmount,
  betCount,
  stopGain,
  stopLoss,
  diceTarget,
  coinSide,
  rouletteSpots,
  kenoSpots,
  maxHouseEdgeBps = 10000,
  messages
}: BuildGamePlaceBetInputArgs): BuildGamePlaceBetInputResult {
  const gameParams = buildGameParams({
    slug: game.slug,
    diceTarget,
    coinSide,
    rouletteSpots,
    kenoSpots,
    messages
  });

  if (!gameParams.ok) {
    return { ok: false, message: gameParams.message };
  }

  const casinoPool = findCasinoPool(release.pools);
  if (!casinoPool?.asset) {
    return {
      ok: false,
      message:
        messages?.noActiveCasinoPool ?? "No active casino pool is available in the current release."
    };
  }

  const assetMeta =
    release.assets.find(
      (asset) => asset.address?.toLowerCase() === casinoPool.asset?.toLowerCase()
    ) ?? findUSDCAsset(release.assets);
  const decimals = casinoPool.decimals ?? assetMeta?.decimals ?? 6;
  const amountPerRoll = toUnits(betAmount, decimals);
  const normalizedBetCount = Math.max(1, Math.floor(betCount));
  const totalStake = amountPerRoll * BigInt(normalizedBetCount);

  const stakeSpec = encodeStakeSpec({
    amountPerRoll,
    betCount: normalizedBetCount,
    stopGain: stopGain > 0 ? toUnits(stopGain, decimals) : 0n,
    stopLoss: stopLoss > 0 ? toUnits(stopLoss, decimals) : 0n
  });

  return {
    ok: true,
    params: gameParams.params,
    input: {
      chainId: release.chainId,
      gameId: game.gameId,
      poolId: casinoPool.poolId,
      betCount: normalizedBetCount,
      stake: totalStake,
      params: gameParams.params,
      stakeSpec,
      maxHouseEdgeBps: Math.max(0, Math.min(10000, Math.floor(maxHouseEdgeBps)))
    }
  };
}
