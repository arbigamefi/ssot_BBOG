import { splitAmount, type SignedAmount } from "../../home/receipts";
import type { CasinoOutcome } from "../room/outcome";
import type { SicBoKind } from "../room/params";
import { SIC_BO_FACTOR_TABLE, SIC_BO_TOTAL_COUNTS, sicBoWinChance } from "../room/payouts";

// Sic bo as SicBoModule plays it: one bet a wager on one area of the layout, the params
// (uint8 kind, uint8 value). Three dice a roll, each roll % 6 + 1. Small (4 to 10) and Big (11 to
// 17) lose on any triple; Any triple pays 36, a chosen triple 216, a chosen double 13.5, a total
// 216 over its ways, and a single face 2 for every die that shows it. A winning roll pays
// floor(stake × factor / 10000) gross, and GameHub takes the release's house edge off that.

export type SicBoOutcome = Extract<CasinoOutcome, { kind: "sic-bo" }>;
export type SicBoRoll = SicBoOutcome["rolls"][number];
export type Dice = readonly [number, number, number];

/** An area of the layout: what you bet on. */
export type Area = { kind: SicBoKind; value: number };

/** What one die showing a chosen face pays, gross: 2 × the stake. */
export const SINGLE_FACE_FACTOR = SIC_BO_FACTOR_TABLE.singleFaceMax / 3;

const FACES = [1, 2, 3, 4, 5, 6] as const;
const TOTALS = Array.from({ length: 14 }, (_, k) => k + 4);

/**
 * The layout as it is printed on the felt, row by row: Small, Any triple and Big; the doubles and
 * the triples; the totals 4 to 17; the single faces.
 */
export const ROWS: ReadonlyArray<{ id: "a" | "b" | "c" | "d"; areas: readonly Area[] }> = [
  {
    id: "a",
    areas: [
      { kind: "small", value: 0 },
      { kind: "anyTriple", value: 0 },
      { kind: "big", value: 0 }
    ]
  },
  {
    id: "b",
    areas: [
      ...FACES.map((value) => ({ kind: "specificDouble" as const, value })),
      ...FACES.map((value) => ({ kind: "specificTriple" as const, value }))
    ]
  },
  { id: "c", areas: TOTALS.map((value) => ({ kind: "total" as const, value })) },
  { id: "d", areas: FACES.map((value) => ({ kind: "singleFace" as const, value })) }
];

export const sameArea = (a: Area, b: Area) => a.kind === b.kind && a.value === b.value;
export const areaKey = (area: Area) => `${area.kind}:${area.value}`;

/** A total's factor: 216 × 10000 over the ways three dice make it, floored. */
export const totalFactor = (total: number) => {
  const ways = SIC_BO_TOTAL_COUNTS[total] ?? 0;
  return ways > 0 ? Math.floor((216 * 10_000) / ways) : 0;
};

/** What a roll pays an area, gross, in basis points of the stake: SicBoModule's factor. */
export function factorOf({ kind, value }: Area, dice: Dice) {
  const [a, b, c] = dice;
  const total = a + b + c;
  const triple = a === b && b === c;
  const count = dice.filter((die) => die === value).length;
  switch (kind) {
    case "small":
      return !triple && total <= 10 ? SIC_BO_FACTOR_TABLE.smallBig : 0;
    case "big":
      return !triple && total >= 11 ? SIC_BO_FACTOR_TABLE.smallBig : 0;
    case "anyTriple":
      return triple ? SIC_BO_FACTOR_TABLE.anyTriple : 0;
    case "specificTriple":
      return triple && a === value ? SIC_BO_FACTOR_TABLE.specificTriple : 0;
    case "total":
      return total === value ? totalFactor(value) : 0;
    case "specificDouble":
      return count >= 2 ? SIC_BO_FACTOR_TABLE.specificDouble : 0;
    case "singleFace":
      return SINGLE_FACE_FACTOR * count;
  }
}

/** An area's printed factor: a single face is quoted for one die that shows it. */
export function headlineFactor({ kind, value }: Area) {
  switch (kind) {
    case "small":
    case "big":
      return SIC_BO_FACTOR_TABLE.smallBig;
    case "anyTriple":
      return SIC_BO_FACTOR_TABLE.anyTriple;
    case "specificTriple":
      return SIC_BO_FACTOR_TABLE.specificTriple;
    case "specificDouble":
      return SIC_BO_FACTOR_TABLE.specificDouble;
    case "total":
      return totalFactor(value);
    case "singleFace":
      return SINGLE_FACE_FACTOR;
  }
}

/** One winning roll's payout as GameHub pays it: the gross less the house edge on it, floored. */
export function payoutFor(perRound: bigint, factor: number, houseEdgeBps: number) {
  const gross = (perRound * BigInt(factor)) / 10_000n;
  return gross - (gross * BigInt(houseEdgeBps)) / 10_000n;
}

/** What a win on an area pays per unit staked, cut to two decimals: 2.01, 35.28, 1.96 a die. */
export function areaMultiplier(area: Area, houseEdgeBps: number, dice = 1): SignedAmount {
  const factor = headlineFactor(area) * (area.kind === "singleFace" ? dice : 1);
  return { ...splitAmount(payoutFor(1_000_000n, factor, houseEdgeBps), 6, 2), sign: "" };
}

/** A multiplier as text: "2.01". */
export const multiplierText = (value: SignedAmount) =>
  value.fraction ? `${value.whole}.${value.fraction}` : value.whole;

/**
 * An area's win chance in percent, as printed: one decimal, two under 1% (a chosen triple is
 * 0.46%).
 */
export function areaChance({ kind, value }: Area) {
  const chance = sicBoWinChance(kind, value);
  return chance.toFixed(chance < 1 ? 2 : 1);
}

export const diceTotal = (dice: Dice) => dice[0] + dice[1] + dice[2];

/** The rolls of an outcome, as dice. */
export const diceOf = (outcome: SicBoOutcome): Dice[] => outcome.rolls.map((roll) => roll.dice);
