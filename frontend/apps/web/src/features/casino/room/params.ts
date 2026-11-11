import {
  encodeBaccaratParams,
  encodeCoinTossParams,
  encodeDiceParams,
  encodeKenoParams,
  encodePlinkoParams,
  encodeRouletteParams,
  encodeSicBoParams,
  encodeSlotsParams,
  type BaccaratSide,
  type PlinkoRisk,
  type RouletteParamsInput,
  type SicBoKind
} from "@ssot/ssot/encoding";

import { KENO_GAIN_TABLE } from "@ssot/ssot/domain";

import { RED_NUMBER_SET, RED_NUMBERS, kenoWinChance } from "./model";
import {
  type DiceDirection,
  PLINKO_FACTOR_TABLE,
  BACCARAT_FACTOR_TABLE,
  SIC_BO_TOTAL_COUNTS,
  SIC_BO_FACTOR_TABLE,
  plinkoPositiveChance,
  slotsPositiveChance,
  baccaratWinChance,
  normalizeSicBoValue,
  sicBoWinChance
} from "./payouts";

export type CoinSide = "HEADS" | "TAILS";
export type { BaccaratSide, PlinkoRisk, SicBoKind };
export type GameParamsHex = `0x${string}`;

export type BuildGameParamsInput = {
  slug: string;
  diceTarget: number;
  diceDirection: DiceDirection;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide?: BaccaratSide;
  sicBoKind?: SicBoKind;
  sicBoValue?: number;
  messages?: GameParamsMessages;
};

export type BuildGameParamsResult =
  | { ok: true; params: GameParamsHex }
  | { ok: false; message: string };

export type GameParamsMessages = {
  rouletteSelectionRequired?: string;
  kenoSelectionRequired?: string;
  kenoSelectionInvalid?: string;
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

// Column bets ("col1" → 1,4,7,…,34; "col2" → 2,5,…,35; "col3" → 3,6,…,36).
// Encoded against the SSOT column kind so the contract pays 2:1.
const COLUMN_ROULETTE_BETS: Record<string, 1 | 2 | 3> = {
  col1: 1,
  col2: 2,
  col3: 3
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
      // Pure add — must NOT do "add 1..36 then delete red", because that
      // also strips red numbers contributed by an earlier RED/ODD/EVEN/etc
      // bet, making the union order-dependent (and the on-chain bitmask
      // wrong, since buildRouletteBitmask shares this function).
      for (let n = 1; n <= 36; n += 1) {
        if (!RED_NUMBER_SET.has(n)) covered.add(n);
      }
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
    } else if (spot === "col1") {
      addRange(covered, 1, 34, 3);
    } else if (spot === "col2") {
      addRange(covered, 2, 35, 3);
    } else if (spot === "col3") {
      addRange(covered, 3, 36, 3);
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
    if (COLUMN_ROULETTE_BETS[singleSpot])
      return { kind: "column", column: COLUMN_ROULETTE_BETS[singleSpot] };
    if (isStraightNumber(singleSpot)) return { kind: "straight", number: Number(singleSpot) };
  }

  return { kind: "bitmask", mask: buildRouletteBitmask(spots) };
}

export function buildKenoMask(spots: readonly number[]): bigint {
  let mask = 0n;
  for (const n of spots) {
    if (Number.isInteger(n) && n >= 1 && n <= 15) {
      mask |= 1n << BigInt(n - 1);
    }
  }
  return mask;
}

export function calculateGameWinChance(input: {
  slug: string;
  diceTarget: number;
  diceDirection: DiceDirection;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide?: BaccaratSide;
  sicBoKind?: SicBoKind;
  sicBoValue?: number;
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
  if (input.slug === "sic-bo") {
    const kind = input.sicBoKind ?? "small";
    return sicBoWinChance(kind, normalizeSicBoValue(kind, input.sicBoValue));
  }
  return 100;
}

export type ReserveRatio = { numerator: bigint; denominator: bigint };

export type ReserveSelection = {
  slug: string;
  diceTarget: number;
  diceDirection: DiceDirection;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide?: BaccaratSide;
  sicBoKind?: SicBoKind;
  sicBoValue?: number;
};

/** Exact maxPayout ratios from the admitted module rules, before the house edge. */
export function calculateGameReserveRatio(input: ReserveSelection): ReserveRatio | undefined {
  const ratio = (numerator: number | bigint, denominator: number | bigint = 10_000n) => ({
    numerator: BigInt(numerator),
    denominator: BigInt(denominator)
  });
  if (input.slug === "dice") {
    const wins = input.diceDirection === "under" ? input.diceTarget : 100 - input.diceTarget;
    return Number.isInteger(wins) && wins >= 1 && wins <= 99 ? ratio(100, wins) : undefined;
  }
  if (input.slug === "coin-toss") return ratio(2, 1);
  if (input.slug === "roulette") {
    const covered = rouletteCoveredNumbers(input.rouletteSpots).length;
    return covered > 0 && covered < 37 ? ratio(37, covered) : undefined;
  }
  if (input.slug === "keno") {
    const row = KENO_GAIN_TABLE[input.kenoSpots.length];
    return row ? ratio(Math.max(...row)) : undefined;
  }
  if (input.slug === "plinko") return ratio(Math.max(...PLINKO_FACTOR_TABLE[input.plinkoRisk]));
  if (input.slug === "slots") return ratio(64, 1);
  if (input.slug === "baccarat")
    return ratio(BACCARAT_FACTOR_TABLE[input.baccaratSide ?? "player"]);
  if (input.slug === "sic-bo") {
    const kind = input.sicBoKind ?? "small";
    if (kind === "small" || kind === "big") return ratio(SIC_BO_FACTOR_TABLE.smallBig);
    if (kind === "total") {
      const count = SIC_BO_TOTAL_COUNTS[normalizeSicBoValue(kind, input.sicBoValue)];
      return count ? ratio((216n * 10_000n) / BigInt(count)) : undefined;
    }
    return ratio(
      kind === "anyTriple"
        ? SIC_BO_FACTOR_TABLE.anyTriple
        : kind === "specificTriple"
          ? SIC_BO_FACTOR_TABLE.specificTriple
          : kind === "specificDouble"
            ? SIC_BO_FACTOR_TABLE.specificDouble
            : SIC_BO_FACTOR_TABLE.singleFaceMax
    );
  }
  return undefined;
}

/** Approximate numeric odds are for display only; capacity always uses the ratio. */
export function calculateGameReserveMultiplier(input: ReserveSelection): number {
  const ratio = calculateGameReserveRatio(input);
  return ratio ? Number(ratio.numerator) / Number(ratio.denominator) : 0;
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
    const uniqueSpots = new Set(input.kenoSpots);
    if (
      input.kenoSpots.length > 5 ||
      uniqueSpots.size !== input.kenoSpots.length ||
      input.kenoSpots.some((spot) => !Number.isInteger(spot) || spot < 1 || spot > 15)
    ) {
      return {
        ok: false,
        message: input.messages?.kenoSelectionInvalid ?? "—"
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

  if (input.slug === "sic-bo") {
    const kind = input.sicBoKind ?? "small";
    return {
      ok: true,
      params: encodeSicBoParams({ kind, value: normalizeSicBoValue(kind, input.sicBoValue) })
    };
  }

  return { ok: true, params: "0x" };
}
