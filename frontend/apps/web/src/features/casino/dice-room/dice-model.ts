import type { DiceDirection } from "../room/payouts";
import { multiplierFor, payoutFor } from "../table-room/slip-model";

// The dice room's odds: which numbers win and what a win pays (DiceModule and GameHub flooring).

/** Winning numbers out of 100: low wins on 1..line, high on line+1..100. */
export function diceWins(direction: DiceDirection, line: number) {
  return direction === "under" ? line : 100 - line;
}

export function diceWinRange(direction: DiceDirection, line: number): readonly [number, number] {
  return direction === "under" ? [1, line] : [line + 1, 100];
}

export function diceLoseRange(direction: DiceDirection, line: number): readonly [number, number] {
  return direction === "under" ? [line + 1, 100] : [1, line];
}

/** One winning round's payout, as DiceModule and GameHub compute it: the gross payout less the house edge. */
export function dicePayout(perRound: bigint, wins: number, houseEdgeBps: number) {
  return payoutFor(perRound, 100, wins, houseEdgeBps);
}

/** What one unit pays on a win, cut to two decimals. A multiplier carries no sign. */
export function diceMultiplier(wins: number, houseEdgeBps: number) {
  return multiplierFor(100, wins, houseEdgeBps);
}
