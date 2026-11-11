import type { PlinkoRisk } from "@ssot/ssot/encoding";

import { splitAmount, type SignedAmount } from "../../home/receipts";
import { PLINKO_FACTOR_TABLE } from "../room/payouts";
import { CUPS, ROWS } from "./drop-motion";

// Plinko as PlinkoModule plays it: eight rows, each a fair left or right, and the cup is the
// number of rights (0 to 8). The three risks share the cups and their odds and only pay them
// differently: every cup has a gross factor, factor(risk, cup) / 10000, from the module's table
// (room/payouts.ts). A ball pays floor(stake × factor / 10000) gross; GameHub takes the release's
// house edge off it (docs/games/plinko.md).

export const RISKS: readonly PlinkoRisk[] = ["low", "medium", "high"];
/** In how many of the 256 paths a ball lands in each cup. */
export const WEIGHTS = [1, 8, 28, 56, 70, 56, 28, 8, 1] as const;
const PATHS = 2 ** ROWS;
export const CUP_LIST = Array.from({ length: CUPS }, (_, k) => k);

/** One ball's gross payout: floor(stake × factor / 10000). */
export function plinkoGross(perRound: bigint, risk: PlinkoRisk, cup: number) {
  return (perRound * BigInt(PLINKO_FACTOR_TABLE[risk][cup] ?? 0)) / 10_000n;
}

/** One ball's payout as GameHub pays it: gross less the house edge on it, floored. */
export function plinkoPayout(
  perRound: bigint,
  risk: PlinkoRisk,
  cup: number,
  houseEdgeBps: number
) {
  const gross = plinkoGross(perRound, risk, cup);
  return gross - (gross * BigInt(houseEdgeBps)) / 10_000n;
}

const UNIT = 1_000_000n;

/** What one unit pays in `cup`, cut to two decimals: 8.10 for an outer cup at medium risk. */
export function cupMultiplier(risk: PlinkoRisk, cup: number, houseEdgeBps: number): SignedAmount {
  return { ...splitAmount(plinkoPayout(UNIT, risk, cup, houseEdgeBps), 6, 2), sign: "" };
}

/**
 * The same pay as the narrow cups print it: three figures, still cut down (24.12 → 24.1, 8.10
 * stays 8.10).
 */
export function cupFigure(risk: PlinkoRisk, cup: number, houseEdgeBps: number): SignedAmount {
  const pay = cupMultiplier(risk, cup, houseEdgeBps);
  const keep = Math.max(0, 3 - pay.whole.length);
  return { ...pay, fraction: pay.fraction.slice(0, keep) };
}

/** True when `cup` pays back more than the stake: a net win. */
export function paysMore(risk: PlinkoRisk, cup: number, houseEdgeBps: number) {
  return plinkoPayout(UNIT, risk, cup, houseEdgeBps) > UNIT;
}

/** How often a ball lands in `cup`, in percent to one decimal: "27.3" for the middle. */
export const cupOdds = (cup: number) => (((WEIGHTS[cup] ?? 0) / PATHS) * 100).toFixed(1);

/**
 * The chance of a net win per ball, in percent to one decimal. At a 2% edge it is 28.9 for every
 * risk: the outer six cups win at every level.
 */
export function plinkoChance(risk: PlinkoRisk, houseEdgeBps: number) {
  let winning = 0;
  for (const cup of CUP_LIST) if (paysMore(risk, cup, houseEdgeBps)) winning += WEIGHTS[cup]!;
  return ((winning / PATHS) * 100).toFixed(1);
}

/** A ball's path as the outcome reports it, as rights: true for a right. */
export const pathBits = (path: ReadonlyArray<"L" | "R">) => path.map((step) => step === "R");

/** The cup that pays the most of these balls: the one the chips are paid onto. */
export function bestCup(risk: PlinkoRisk, cups: readonly number[]) {
  const factor = (cup: number) => PLINKO_FACTOR_TABLE[risk][cup] ?? 0;
  return cups.reduce((best, cup) => (factor(cup) > factor(best) ? cup : best), cups[0] ?? 0);
}
