import { splitAmount, type SignedAmount } from "../../home/receipts";
import type { CasinoOutcome } from "../room/outcome";
import type { BaccaratSide } from "../room/params";
import { BACCARAT_FACTOR_TABLE, baccaratWinChance } from "../room/payouts";

// Baccarat as BaccaratModule plays it: you back Player, Banker or Tie (the params are one uint8,
// 0 Player, 1 Banker, 2 Tie). Every card is rank % 13 of its own draw, an endless shoe: ace 1, 2 to
// 9 at face value, 10 and pictures 0. The deal is P, B, P, B; 8 or 9 is a natural; otherwise the
// standard third-card rule. A tie loses Player and Banker bets. A winning hand pays
// floor(stake × factor / 10000) gross, and GameHub takes the release's house edge off that.

export type BaccaratOutcome = Extract<CasinoOutcome, { kind: "baccarat" }>;
export type BaccaratHand = BaccaratOutcome["rolls"][number];

/** The three spots on the felt, left to right: Player, Tie, Banker under their hands. */
export const SPOTS: readonly BaccaratSide[] = ["player", "tie", "banker"];
/** The two hands, as the felt lays them out. */
export const HANDS = ["player", "banker"] as const;
export type HandSide = (typeof HANDS)[number];

/** The win chance of a side, in percent to one decimal: 44.6, 45.8 or 9.5 of the 13^6 deals. */
export const sideChance = (side: BaccaratSide) => baccaratWinChance(side).toFixed(1);

/** One winning hand's gross payout: floor(stake × factor / 10000). */
export function baccaratGross(perRound: bigint, side: BaccaratSide) {
  return (perRound * BigInt(BACCARAT_FACTOR_TABLE[side])) / 10_000n;
}

/** One winning hand's payout as GameHub pays it: gross less the house edge on it, floored. */
export function baccaratPayout(perRound: bigint, side: BaccaratSide, houseEdgeBps: number) {
  const gross = baccaratGross(perRound, side);
  return gross - (gross * BigInt(houseEdgeBps)) / 10_000n;
}

/** What a win on `side` pays per unit staked, cut to two decimals: 2.19, 2.13 or 10.26 at 2%. */
export function sideMultiplier(side: BaccaratSide, houseEdgeBps: number): SignedAmount {
  return { ...splitAmount(baccaratPayout(1_000_000n, side, houseEdgeBps), 6, 2), sign: "" };
}

/** A multiplier as text: "2.19". */
export const multiplierText = (value: SignedAmount) =>
  value.fraction ? `${value.whole}.${value.fraction}` : value.whole;

/** A rank's points: ace 1, 2 to 9 at face value, 10 and pictures 0. */
export const points = (rank: number) => (rank <= 8 ? rank + 1 : 0);

/** A hand's total: the last digit of its points. */
export const handTotal = (ranks: readonly number[]) =>
  ranks.reduce((sum, rank) => sum + points(rank), 0) % 10;

/** A rank as printed on the card's corner: A, 2 to 10, J, Q, K. */
export const RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const rankLabel = (rank: number) => RANK_LABELS[rank] ?? "";

/** The four suits: spade, heart, diamond, club. Hearts and diamonds are red. */
export type Suit = 0 | 1 | 2 | 3;
export const isRed = (suit: Suit) => suit === 1 || suit === 2;

/**
 * A hand's suits, in deal order P1 B1 P2 B2 P3 B3. The contract draws ranks only, so suits are for
 * show: drawn at random once per outcome, the same on the felt and on the receipt.
 */
const suitCache = new WeakMap<BaccaratHand, Suit[]>();
export function suitsOf(hand: BaccaratHand): Suit[] {
  let suits = suitCache.get(hand);
  if (!suits) {
    suits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 4) as Suit);
    suitCache.set(hand, suits);
  }
  return suits;
}

/** The suit of card `k` (0, 1 or 2) of a hand's side. */
export const suitOf = (suits: readonly Suit[], side: HandSide, k: number): Suit =>
  suits[k * 2 + (side === "banker" ? 1 : 0)] ?? 0;

/** A hand's cards on one side, as ranks. */
export const ranksOf = (hand: BaccaratHand, side: HandSide) =>
  side === "player" ? hand.playerRanks : hand.bankerRanks;

/** Whether the first two cards made a natural: 8 or 9 on either side. */
export function naturalOf(hand: BaccaratHand) {
  const player = handTotal(hand.playerRanks.slice(0, 2));
  const banker = handTotal(hand.bankerRanks.slice(0, 2));
  return player >= 8 || banker >= 8 ? { player, banker } : null;
}
