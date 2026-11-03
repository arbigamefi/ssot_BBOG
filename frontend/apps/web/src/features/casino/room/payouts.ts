import { KENO_GAIN_TABLE } from "@ssot/ssot/keno-gains";
import type { BaccaratSide, PlinkoRisk, SicBoKind } from "@ssot/ssot/encoding";

// Payout tables and odds mirrored from the game modules. They live apart from params.ts, which
// encodes bet params with the SDK, so a page that only shows odds does not load the encoders.

export type DiceDirection = "under" | "over";

/**
 * The room offers a dice win chance from 2% to 97%: at 98% a win would only
 * pay the stake back. Under wins on 1..target, over on target+1..100.
 * DiceModule itself accepts targets 1..99, so this is a website limit.
 */
export function diceTargetBounds(direction: DiceDirection): readonly [number, number] {
  return direction === "under" ? [2, 97] : [3, 98];
}

export function clampDiceTarget(direction: DiceDirection, target: number) {
  const [min, max] = diceTargetBounds(direction);
  return Math.min(max, Math.max(min, target));
}

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
export const BACCARAT_FACTOR_TABLE: Record<BaccaratSide, number> = {
  player: 22414,
  banker: 21813,
  tie: 104793
};

const SIC_BO_TOTAL_OUTCOMES = 216;
const SIC_BO_SMALL_BIG_COUNT = 105;
export const SIC_BO_TOTAL_COUNTS: Record<number, number> = {
  4: 3,
  5: 6,
  6: 10,
  7: 15,
  8: 21,
  9: 25,
  10: 27,
  11: 27,
  12: 25,
  13: 21,
  14: 15,
  15: 10,
  16: 6,
  17: 3
};
export const SIC_BO_FACTOR_TABLE = {
  smallBig: 20_571,
  anyTriple: 360_000,
  specificTriple: 2_160_000,
  specificDouble: 135_000,
  singleFaceMax: 60_000
} as const;

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

/**
 * Highest payout multiplier for a Keno ticket of `spotCount` spots — i.e.
 * matching ALL of them (e.g. 5 spots → 500.5×). Keno's payout is a table that
 * varies by both spot count AND match count, so the *max* (hit-all) is what
 * bounds the bank's reserve and therefore the max bet. Sourced from the
 * contract-mirrored KENO_GAIN_TABLE. Returns 0 when no/invalid spot count.
 */
export function kenoMaxMultiplier(spotCount: number): number {
  const row = KENO_GAIN_TABLE[spotCount];
  if (!row || row.length === 0) return 0;
  return Math.max(...row) / 10_000;
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

export function normalizeSicBoValue(kind: SicBoKind, value: number | undefined): number {
  if (kind === "total") return Math.min(17, Math.max(4, Math.floor(value ?? 10)));
  if (kind === "specificTriple" || kind === "specificDouble" || kind === "singleFace") {
    return Math.min(6, Math.max(1, Math.floor(value ?? 1)));
  }
  return 0;
}

export function sicBoWinChance(kind: SicBoKind, value: number): number {
  if (kind === "small" || kind === "big") return (SIC_BO_SMALL_BIG_COUNT / 216) * 100;
  if (kind === "anyTriple") return (6 / SIC_BO_TOTAL_OUTCOMES) * 100;
  if (kind === "specificTriple") return (1 / SIC_BO_TOTAL_OUTCOMES) * 100;
  if (kind === "total") {
    return (
      ((SIC_BO_TOTAL_COUNTS[normalizeSicBoValue(kind, value)] ?? 0) / SIC_BO_TOTAL_OUTCOMES) * 100
    );
  }
  if (kind === "specificDouble") return (16 / SIC_BO_TOTAL_OUTCOMES) * 100;
  return (91 / SIC_BO_TOTAL_OUTCOMES) * 100;
}

export function sicBoMultiplier(kind: SicBoKind, value: number): number {
  if (kind === "small" || kind === "big") return SIC_BO_FACTOR_TABLE.smallBig / 10_000;
  if (kind === "anyTriple") return SIC_BO_FACTOR_TABLE.anyTriple / 10_000;
  if (kind === "specificTriple") return SIC_BO_FACTOR_TABLE.specificTriple / 10_000;
  if (kind === "total") {
    const count = SIC_BO_TOTAL_COUNTS[normalizeSicBoValue(kind, value)] ?? 0;
    return count > 0 ? Math.floor((216 * 10_000) / count) / 10_000 : 0;
  }
  if (kind === "specificDouble") return SIC_BO_FACTOR_TABLE.specificDouble / 10_000;
  return SIC_BO_FACTOR_TABLE.singleFaceMax / 10_000;
}

export function applyHouseEdgeToMultiplier(multiplier: number, houseEdgeBps: number): number {
  if (!(multiplier > 0)) return 0;
  const clampedBps = Math.min(10_000, Math.max(0, Math.round(houseEdgeBps)));
  return multiplier * ((10_000 - clampedBps) / 10_000);
}
