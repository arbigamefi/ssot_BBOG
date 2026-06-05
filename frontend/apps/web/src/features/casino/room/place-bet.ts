import type { PlaceBetInput } from "@ssot/ssot";
import type { Address } from "@ssot/ssot/sdk";
import { encodeStakeSpec } from "@ssot/ssot/encoding";
import { parseDecimalToUnits } from "../../betting/model/units";
import {
  getCasinoPoolAssetContexts,
  getDefaultCasinoPoolAssetContext,
  type ReleaseAssetLike,
  type ReleasePoolLike
} from "../../assets/pool-asset";

import type { GameMeta } from "./model";
import {
  buildGameParams,
  type BaccaratSide,
  type CoinSide,
  type DiceDirection,
  type GameParamsHex,
  type GameParamsMessages,
  type PlinkoRisk,
  type SicBoKind
} from "./params";

export type GameRoomRelease = {
  chainId: number;
  assets: readonly ReleaseAssetLike[];
  pools: readonly ReleasePoolLike[];
};

export type BuildGamePlaceBetInputArgs = {
  release: GameRoomRelease;
  game: GameMeta;
  betAmount: number;
  betCount: number;
  stopGain: number;
  stopLoss: number;
  diceTarget: number;
  diceDirection: DiceDirection;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide?: BaccaratSide;
  sicBoKind?: SicBoKind;
  sicBoValue?: number;
  affiliate?: Address;
  /** Selected casino pool. Falls back to the default casino pool when omitted. */
  poolId?: number;
  maxHouseEdgeBps?: number;
  messages?: GamePlaceBetMessages;
};

export type BuildGamePlaceBetInputResult =
  | { ok: true; input: PlaceBetInput; params: GameParamsHex }
  | { ok: false; message: string };

export type GamePlaceBetMessages = GameParamsMessages & {
  noActiveCasinoPool?: string;
  invalidCasinoPool?: string;
};

function toUnits(amount: number, decimals: number) {
  const normalized = Math.max(0, amount);
  const precision = Math.max(0, Math.min(18, decimals));
  const value = normalized.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: precision
  });
  return parseDecimalToUnits(value, decimals);
}

export function findCasinoPool(pools: readonly ReleasePoolLike[]) {
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
  diceDirection,
  coinSide,
  rouletteSpots,
  kenoSpots,
  plinkoRisk,
  baccaratSide,
  sicBoKind,
  sicBoValue,
  affiliate,
  poolId,
  maxHouseEdgeBps = 10000,
  messages
}: BuildGamePlaceBetInputArgs): BuildGamePlaceBetInputResult {
  const gameParams = buildGameParams({
    slug: game.slug,
    diceTarget,
    diceDirection,
    coinSide,
    rouletteSpots,
    kenoSpots,
    plinkoRisk,
    baccaratSide,
    sicBoKind,
    sicBoValue,
    messages
  });

  if (!gameParams.ok) {
    return { ok: false, message: gameParams.message };
  }

  const casinoPools = getCasinoPoolAssetContexts(release);
  // Use the explicitly selected pool when provided; otherwise the default
  // casino pool. A stale/unknown explicit pool must fail closed: silently
  // falling back can wager the wrong asset in a multi-asset room.
  const casinoPool =
    poolId != null
      ? casinoPools.find((context) => context.poolId === poolId)
      : getDefaultCasinoPoolAssetContext(release);
  if (poolId != null && !casinoPool) {
    return {
      ok: false,
      message: messages?.invalidCasinoPool ?? messages?.noActiveCasinoPool ?? "—"
    };
  }
  if (!casinoPool) {
    return {
      ok: false,
      message: messages?.noActiveCasinoPool ?? "—"
    };
  }

  const decimals = casinoPool.asset.decimals;
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
      affiliate,
      maxHouseEdgeBps: Math.max(0, Math.min(10000, Math.floor(maxHouseEdgeBps)))
    }
  };
}
