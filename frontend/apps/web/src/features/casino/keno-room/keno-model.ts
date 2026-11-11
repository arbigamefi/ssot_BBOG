import { kenoGainFactor } from "@ssot/ssot/keno-gains";

import { splitAmount, type SignedAmount } from "../../home/receipts";

// Keno as KenoModule plays it: fifteen numbers, five drawn without replacement, one to five
// picked. Every number of hits has a gross factor, gain(picked, hits) / 10000, from the contract's
// table (@ssot/ssot/keno-gains); the table is fair before the house edge. Some factors are below 1,
// so part of the stake comes back, and with four or five picks even no hits pays more than the
// stake. A round pays floor(stake × gain / 10000) gross; GameHub takes the release's house edge
// off it (docs/games/keno.md).

export const POOL = 15;
export const DRAWN = 5;
export const MAX_PICKS = 5;

const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};
/** Every draw of five from fifteen: 3003. */
export const OUTCOMES = choose(POOL, DRAWN);
/** In how many of the 3003 draws `hits` of `picked` numbers come up. */
export const ways = (picked: number, hits: number) =>
  choose(picked, hits) * choose(POOL - picked, DRAWN - hits);

/** One round's gross payout: floor(stake × gain / 10000). */
export function kenoGross(perRound: bigint, picked: number, hits: number) {
  return (perRound * BigInt(kenoGainFactor(picked, hits))) / 10_000n;
}

/** One round's payout as GameHub pays it: gross less the house edge on it, floored. */
export function kenoPayout(perRound: bigint, picked: number, hits: number, houseEdgeBps: number) {
  const gross = kenoGross(perRound, picked, hits);
  return gross - (gross * BigInt(houseEdgeBps)) / 10_000n;
}

const UNIT = 1_000_000n;

/** What one unit pays for `hits`, cut to two decimals: 11.14 for three of three at a 2% edge. */
export function hitMultiplier(picked: number, hits: number, houseEdgeBps: number): SignedAmount {
  return { ...splitAmount(kenoPayout(UNIT, picked, hits, houseEdgeBps), 6, 2), sign: "" };
}

/** True when `hits` pays back more than the stake: a net win. */
export function paysMore(picked: number, hits: number, houseEdgeBps: number) {
  return kenoPayout(UNIT, picked, hits, houseEdgeBps) > UNIT;
}

/** The chance of a net win in percent, to one decimal: "24.2" for three picks at a 2% edge. */
export function kenoChance(picked: number, houseEdgeBps: number) {
  if (picked < 1 || picked > MAX_PICKS) return "0.0";
  let winning = 0;
  for (let hits = 0; hits <= picked; hits++)
    if (paysMore(picked, hits, houseEdgeBps)) winning += ways(picked, hits);
  return ((winning / OUTCOMES) * 100).toFixed(1);
}

/** How often `hits` comes up: a percent to one decimal from 1%, otherwise one in so many. */
export function hitOdds(picked: number, hits: number) {
  const w = ways(picked, hits);
  const percent = (w / OUTCOMES) * 100;
  return percent >= 1
    ? ({ kind: "percent", value: percent.toFixed(1) } as const)
    : ({ kind: "oneIn", value: Math.round(OUTCOMES / w) } as const);
}

/** How many of the picked numbers a draw hit. */
export const hitsOf = (picks: readonly number[], drawn: readonly number[]) =>
  drawn.filter((n) => picks.includes(n)).length;

/** The number of hits that pays the most of these rounds: the one the chips are paid onto. */
export function bestHits(picked: number, hits: readonly number[]) {
  return hits.reduce(
    (best, h) => (kenoGainFactor(picked, h) > kenoGainFactor(picked, best) ? h : best),
    hits[0] ?? 0
  );
}
