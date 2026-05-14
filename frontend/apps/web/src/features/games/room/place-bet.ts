import type { PlaceBetInput } from "@ssot/ssot";
import { encodeStakeSpec } from "@ssot/ssot/encoding";

import type { GameMeta } from "./model";
import { buildGameParams, type CoinSide, type GameParamsHex } from "./params";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

type ReleaseAsset = {
  symbol?: string;
  address?: string;
  decimals?: number;
};

type GameRoomRelease = {
  chainId: number;
  assets: readonly ReleaseAsset[];
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
};

export type BuildGamePlaceBetInputResult =
  | { ok: true; input: PlaceBetInput; params: GameParamsHex }
  | { ok: false; message: string };

function toUnits(amount: number, decimals: number) {
  return BigInt(Math.floor(Math.max(0, amount))) * BigInt(Math.pow(10, decimals));
}

export function findUSDCAsset(assets: readonly ReleaseAsset[]) {
  return assets.find((asset) => asset.symbol === "USDC");
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
  maxHouseEdgeBps = 10000
}: BuildGamePlaceBetInputArgs): BuildGamePlaceBetInputResult {
  const gameParams = buildGameParams({
    slug: game.slug,
    diceTarget,
    coinSide,
    rouletteSpots,
    kenoSpots
  });

  if (!gameParams.ok) {
    return { ok: false, message: gameParams.message };
  }

  const usdcAsset = findUSDCAsset(release.assets);
  const decimals = usdcAsset?.decimals ?? 6;
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
      asset: (usdcAsset?.address ?? ZERO_ADDRESS) as `0x${string}`,
      betCount: normalizedBetCount,
      stake: totalStake,
      params: gameParams.params,
      stakeSpec,
      maxHouseEdgeBps: Math.max(0, Math.min(10000, Math.floor(maxHouseEdgeBps)))
    }
  };
}
