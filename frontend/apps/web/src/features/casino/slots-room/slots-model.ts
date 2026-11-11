import { splitAmount, type SignedAmount } from "../../home/receipts";

// The slots game as SlotsModule plays it: three reels, eight symbols each, every symbol equally
// likely on every reel. Gross pays per round include the stake: three sevens 64x, any other three
// alike 16x, exactly two alike 2x. The table is fair before the house edge: 64 + 7 × 16 + 168 × 2
// = 512. GameHub takes the release's house edge off a win (docs/games/slots.md).

/** 0 cherry, 1 lemon, 2 bell, 3 diamond, 4 crown, 5 star, 6 bar, 7 seven. */
export const SYMBOLS = [
  "cherry",
  "lemon",
  "bell",
  "diamond",
  "crown",
  "star",
  "bar",
  "seven"
] as const;
export type SymbolName = (typeof SYMBOLS)[number];
export const SEVEN = 7;

export type SlotsLine = "jackpot" | "three" | "pair";
export type Multiple = 0 | 2 | 16 | 64;

/** The pay table, top line first: what each line pays gross, and in how many of 512 spins. */
export const PAY_LINES: ReadonlyArray<{
  key: SlotsLine;
  multiple: Exclude<Multiple, 0>;
  count: number;
}> = [
  { key: "jackpot", multiple: 64, count: 1 },
  { key: "three", multiple: 16, count: 7 },
  { key: "pair", multiple: 2, count: 168 }
];
export const OUTCOMES = 512;
/** Spins that pay anything: 1 + 7 + 168. */
export const WINNING = PAY_LINES.reduce((sum, line) => sum + line.count, 0);

/** What a spin pays gross, per unit staked. */
export function slotsMultiple([a, b, c]: readonly number[]): Multiple {
  if (a === b && b === c) return a === SEVEN ? 64 : 16;
  if (a === b || a === c || b === c) return 2;
  return 0;
}

export function lineOf(multiple: number): SlotsLine | null {
  return multiple === 64 ? "jackpot" : multiple === 16 ? "three" : multiple === 2 ? "pair" : null;
}

/** The reels that make a spin's win: all three for three alike, the pair's two for two alike. */
export function winningReels([a, b, c]: readonly number[]): number[] {
  if (a === b && b === c) return [0, 1, 2];
  if (a === b) return [0, 1];
  if (a === c) return [0, 2];
  if (b === c) return [1, 2];
  return [];
}

/** One round's payout for a line, as GameHub pays it: gross less the house edge on it, floored. */
export function slotsPayout(perRound: bigint, multiple: number, houseEdgeBps: number) {
  const gross = perRound * BigInt(multiple);
  return gross - (gross * BigInt(houseEdgeBps)) / 10_000n;
}

/** What one unit pays on a line, cut to two decimals: 62.72 at a 2% edge. */
export function lineMultiplier(multiple: number, houseEdgeBps: number): SignedAmount {
  return { ...splitAmount(slotsPayout(1_000_000n, multiple, houseEdgeBps), 6, 2), sign: "" };
}

/** The win chance in percent, to one decimal: "34.4". */
export const slotsChance = () => ((WINNING / OUTCOMES) * 100).toFixed(1);
