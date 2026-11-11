import { splitAmount, type SignedAmount } from "../../home/receipts";
import type { CoinSide } from "../room/params";

// Coin toss as CoinTossModule plays it: you call heads or tails (the params are one bool, true for
// tails); each flip is roll % 2, 1 for tails; a match pays twice the stake gross, and GameHub takes
// the release's house edge off that.

export const SIDES: readonly CoinSide[] = ["HEADS", "TAILS"];

/** The win chance of a call, in percent to one decimal: the coin is fair. */
export const COIN_CHANCE = "50.0";

/** One matching flip's payout as GameHub pays it: twice the stake, less the house edge on it. */
export function coinPayout(perRound: bigint, houseEdgeBps: number) {
  const gross = 2n * perRound;
  return gross - (gross * BigInt(houseEdgeBps)) / 10_000n;
}

/** What a match pays per unit staked, cut to two decimals: 1.96 at a 2% edge. */
export function matchMultiplier(houseEdgeBps: number): SignedAmount {
  return { ...splitAmount(coinPayout(1_000_000n, houseEdgeBps), 6, 2), sign: "" };
}

/** The side as a word key: "heads" or "tails". */
export const sideKey = (side: CoinSide) => (side === "TAILS" ? "tails" : "heads");
