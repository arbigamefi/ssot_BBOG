import {
  encodeBaccaratParams,
  encodeCoinTossParams,
  encodeDiceParams,
  encodeKenoParams,
  encodePlinkoParams,
  encodeRouletteParams,
  encodeSlotsParams,
  type BaccaratSide,
  type PlinkoRisk,
  type RouletteParamsInput
} from "@ssot/ssot/encoding";

import { RED_NUMBER_SET, RED_NUMBERS, kenoWinChance } from "./model";

export type CoinSide = "HEADS" | "TAILS";
export type DiceDirection = "under" | "over";
export type { BaccaratSide, PlinkoRisk };
export type GameParamsHex = `0x${string}`;

export const PLINKO_FACTOR_TABLE: Record<PlinkoRisk, readonly number[]> = {
  low: [15264, 13083, 10902, 9812, 8722, 9812, 10902, 13083, 15264],
  medium: [82714, 34464, 16542, 6892, 2067, 6892, 16542, 34464, 82714],
  high: [246153, 61538, 13186, 3076, 0, 3076, 13186, 61538, 246153]
};

const PLINKO_BUCKET_WEIGHTS = [1, 8, 28, 56, 70, 56, 28, 8, 1] as const;

const BACCARAT_TOTAL_OUTCOMES = 4_826_809;
const BACCARAT_WIN_COUNTS: Record<BaccaratSide, number> = {
  player: 2_153_464,
  banker: 2_212_744,
  tie: 460_601
};
const BACCARAT_FACTOR_TABLE: Record<BaccaratSide, number> = {
  player: 22414,
  banker: 21813,
  tie: 104793
};

export type BuildGameParamsInput = {
  slug: string;
  diceTarget: number;
  diceDirection: DiceDirection;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide?: BaccaratSide;
  messages?: GameParamsMessages;
};

export type BuildGameParamsResult =
  | { ok: true; params: GameParamsHex }
  | { ok: false; message: string };

export type GameParamsMessages = {
  rouletteSelectionRequired?: string;
  kenoSelectionRequired?: string;
};

const NAMED_ROULETTE_BETS: Record<string, "red" | "black" | "odd" | "even" | "low" | "high"> = {
  RED: "red",
  BLACK: "black",
  ODD: "odd",
  EVEN: "even",
  "1-18": "low",
  "19-36": "high"
};

const DOZEN_ROULETTE_BETS: Record<string, 1 | 2 | 3> = {
  "1st 12": 1,
  "2nd 12": 2,
  "3rd 12": 3
};

function addRange(target: Set<number>, start: number, end: number, step = 1) {
  for (let n = start; n <= end; n += step) {
    target.add(n);
  }
}

function isStraightNumber(spot: string): boolean {
  if (!/^\d+$/.test(spot)) return false;
  const number = Number(spot);
  return Number.isInteger(number) && number >= 0 && number <= 36;
}

export function rouletteCoveredNumbers(spots: readonly string[]): number[] {
  const covered = new Set<number>();

  for (const spot of spots) {
    if (spot === "RED") {
      RED_NUMBERS.forEach((n) => covered.add(n));
    } else if (spot === "BLACK") {
      addRange(covered, 1, 36);
      RED_NUMBERS.forEach((n) => covered.delete(n));
    } else if (spot === "ODD") {
      addRange(covered, 1, 36, 2);
    } else if (spot === "EVEN") {
      addRange(covered, 2, 36, 2);
    } else if (spot === "1-18") {
      addRange(covered, 1, 18);
    } else if (spot === "19-36") {
      addRange(covered, 19, 36);
    } else if (spot === "1st 12") {
      addRange(covered, 1, 12);
    } else if (spot === "2nd 12") {
      addRange(covered, 13, 24);
    } else if (spot === "3rd 12") {
      addRange(covered, 25, 36);
    } else if (isStraightNumber(spot)) {
      covered.add(Number(spot));
    }
  }

  return [...covered].sort((a, b) => a - b);
}

export function rouletteWinChance(spots: readonly string[]): number {
  return rouletteCoveredNumbers(spots).length * (100 / 37);
}

export function buildRouletteBitmask(spots: readonly string[]): bigint {
  let bitmask = 0n;
  for (const number of rouletteCoveredNumbers(spots)) {
    bitmask |= 1n << BigInt(number);
  }
  return bitmask;
}

export function createRouletteParamsInput(spots: readonly string[]): RouletteParamsInput | null {
  if (spots.length === 0) return null;

  const [singleSpot] = spots;
  if (spots.length === 1 && singleSpot) {
    if (NAMED_ROULETTE_BETS[singleSpot]) return { kind: NAMED_ROULETTE_BETS[singleSpot] };
    if (DOZEN_ROULETTE_BETS[singleSpot])
      return { kind: "dozen", dozen: DOZEN_ROULETTE_BETS[singleSpot] };
    if (isStraightNumber(singleSpot)) return { kind: "straight", number: Number(singleSpot) };
  }

  return { kind: "bitmask", mask: buildRouletteBitmask(spots) };
}

export function buildKenoMask(spots: readonly number[]): bigint {
  let mask = 0n;
  for (const n of spots) {
    if (Number.isInteger(n) && n >= 1 && n <= 40) {
      mask |= 1n << BigInt(n - 1);
    }
  }
  return mask;
}

export function plinkoPositiveChance(risk: PlinkoRisk): number {
  const table = PLINKO_FACTOR_TABLE[risk];
  const positiveWeight = table.reduce(
    (sum, factor, index) => sum + (factor > 10_000 ? (PLINKO_BUCKET_WEIGHTS[index] ?? 0) : 0),
    0
  );
  return (positiveWeight / 256) * 100;
}

export function plinkoMaxMultiplier(risk: PlinkoRisk): number {
  return Math.max(...PLINKO_FACTOR_TABLE[risk]) / 10_000;
}

export function slotsPositiveChance(): number {
  return (176 / 512) * 100;
}

export function slotsMaxMultiplier(): number {
  return 64;
}

export function baccaratWinChance(side: BaccaratSide): number {
  return (BACCARAT_WIN_COUNTS[side] / BACCARAT_TOTAL_OUTCOMES) * 100;
}

export function baccaratMultiplier(side: BaccaratSide): number {
  return BACCARAT_FACTOR_TABLE[side] / 10_000;
}

export function calculateGameWinChance(input: {
  slug: string;
  diceTarget: number;
  diceDirection: DiceDirection;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide?: BaccaratSide;
}): number {
  if (input.slug === "dice") {
    return input.diceDirection === "under" ? input.diceTarget : 100 - input.diceTarget;
  }
  if (input.slug === "coin-toss") return 50;
  if (input.slug === "roulette") return rouletteWinChance(input.rouletteSpots);
  if (input.slug === "keno")
    return input.kenoSpots.length > 0 ? kenoWinChance(input.kenoSpots.length) : 0;
  if (input.slug === "plinko") return plinkoPositiveChance(input.plinkoRisk);
  if (input.slug === "slots") return slotsPositiveChance();
  if (input.slug === "baccarat") return baccaratWinChance(input.baccaratSide ?? "player");
  return 100;
}

export function buildGameParams(input: BuildGameParamsInput): BuildGameParamsResult {
  if (input.slug === "dice") {
    return {
      ok: true,
      params: encodeDiceParams({ direction: input.diceDirection, target: input.diceTarget })
    };
  }

  if (input.slug === "coin-toss") {
    return { ok: true, params: encodeCoinTossParams(input.coinSide === "TAILS") };
  }

  if (input.slug === "roulette") {
    const rouletteInput = createRouletteParamsInput(input.rouletteSpots);
    if (!rouletteInput) {
      return {
        ok: false,
        message: input.messages?.rouletteSelectionRequired ?? "—"
      };
    }
    return { ok: true, params: encodeRouletteParams(rouletteInput) };
  }

  if (input.slug === "keno") {
    if (input.kenoSpots.length === 0) {
      return {
        ok: false,
        message: input.messages?.kenoSelectionRequired ?? "—"
      };
    }
    return { ok: true, params: encodeKenoParams(buildKenoMask(input.kenoSpots)) };
  }

  if (input.slug === "plinko") {
    return { ok: true, params: encodePlinkoParams(input.plinkoRisk) };
  }

  if (input.slug === "slots") {
    return { ok: true, params: encodeSlotsParams("classic") };
  }

  if (input.slug === "baccarat") {
    return { ok: true, params: encodeBaccaratParams(input.baccaratSide ?? "player") };
  }

  return { ok: true, params: "0x" };
}
