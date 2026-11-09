// The roulette bet as the table, the slip and the receipt show it. RouletteModule takes one set of
// numbers per bet: every chip adds its spot's numbers to that set, and any number in it pays
// gross = floor(stake × 37 / numbers covered), less the release's house edge (slip-model.ts).

import { RED_NUMBER_SET } from "../room/model";
import { rouletteCoveredNumbers } from "../room/params";
import { multiplierFor, payoutFor } from "../table-room/slip-model";

export type PocketColour = "red" | "black" | "zero";

/** A number's pocket: zero is green, the rest red or black. */
export const pocketColour = (n: number): PocketColour =>
  n === 0 ? "zero" : RED_NUMBER_SET.has(n) ? "red" : "black";

/** How a spot is named in copy: `casino.roulette.spot.<name>`, with `n`, `from`, `to` or `c`. */
export type SpotName =
  | { key: "number"; n: number }
  | { key: "low" | "high" | "even" | "odd" | "red" | "black" }
  | { key: "dozen"; from: number; to: number }
  | { key: "column"; c: number };

export type RouletteSpot = {
  /** The spot's key in the room's state and the bet's encoding (room/params.ts). */
  key: string;
  numbers: readonly number[];
  name: SpotName;
  /** Where the spot is printed: grid row and column on the horizontal layout. */
  row: string;
  column: string;
  kind: "number" | "side" | "column";
};

const OUTSIDE: ReadonlyArray<[key: string, name: SpotName]> = [
  ["1-18", { key: "low" }],
  ["EVEN", { key: "even" }],
  ["RED", { key: "red" }],
  ["BLACK", { key: "black" }],
  ["ODD", { key: "odd" }],
  ["19-36", { key: "high" }]
];
const DOZENS = ["1st 12", "2nd 12", "3rd 12"] as const;

/**
 * The layout, printed the way players know it on every screen: 0 on the left, three rows of
 * twelve with 3, 6, … 36 on top, the column bets at the right end, the dozens and then the
 * even-money bets along the front.
 */
export const ROULETTE_SPOTS: readonly RouletteSpot[] = [
  {
    key: "0",
    numbers: [0],
    name: { key: "number", n: 0 },
    row: "1 / span 3",
    column: "1",
    kind: "number"
  },
  ...Array.from({ length: 36 }, (_, i): RouletteSpot => {
    const n = i + 1;
    return {
      key: String(n),
      numbers: [n],
      name: { key: "number", n },
      row: String(3 - ((n - 1) % 3)),
      column: String(Math.ceil(n / 3) + 1),
      kind: "number"
    };
  }),
  ...DOZENS.map(
    (key, d): RouletteSpot => ({
      key,
      numbers: rouletteCoveredNumbers([key]),
      name: { key: "dozen", from: d * 12 + 1, to: d * 12 + 12 },
      row: "4",
      column: `${2 + d * 4} / span 4`,
      kind: "side"
    })
  ),
  ...OUTSIDE.map(
    ([key, name], i): RouletteSpot => ({
      key,
      numbers: rouletteCoveredNumbers([key]),
      name,
      row: "5",
      column: `${2 + i * 2} / span 2`,
      kind: "side"
    })
  ),
  ...[1, 2, 3].map(
    (c): RouletteSpot => ({
      key: `col${c}`,
      numbers: rouletteCoveredNumbers([`col${c}`]),
      name: { key: "column", c },
      row: String(4 - c),
      column: "14",
      kind: "column"
    })
  )
];

const SPOT_BY_KEY = new Map(ROULETTE_SPOTS.map((spot) => [spot.key, spot]));

export const rouletteSpot = (key: string) => SPOT_BY_KEY.get(key);

/** Outside bets first, in the layout's order, then numbers, lowest first. */
function spotOrder(spot: RouletteSpot) {
  return spot.kind === "number" ? 100 + spot.numbers[0]! : ROULETTE_SPOTS.indexOf(spot);
}

/**
 * The bet's name parts: one spot is its name; several are the spots themselves, outside bets
 * first; past four, the first three and how many more.
 */
export function betNames(spots: readonly string[]): { names: SpotName[]; more: number } {
  const sorted = spots
    .map((key) => SPOT_BY_KEY.get(key))
    .filter((spot): spot is RouletteSpot => Boolean(spot))
    .sort((a, b) => spotOrder(a) - spotOrder(b))
    .map((spot) => spot.name);
  return sorted.length > 4
    ? { names: sorted.slice(0, 3), more: sorted.length - 3 }
    : { names: sorted, more: 0 };
}

/** Runs of numbers, as the slip prints which numbers a bet covers: "1–3, 7–9, 12". */
export function numberRuns(numbers: readonly number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    out.push(
      j - i >= 2
        ? `${sorted[i]}–${sorted[j]}`
        : j > i
          ? `${sorted[i]}, ${sorted[j]}`
          : String(sorted[i])
    );
    i = j;
  }
  return out.join(", ");
}

/** Whether a set of chips can be bet: at least one number, and not all 37. */
export function rouletteSelection(covered: number): "empty" | "all" | undefined {
  return covered === 0 ? "empty" : covered >= 37 ? "all" : undefined;
}

/** What one round pays if any covered number comes up. */
export const roulettePayout = (perRound: bigint, covered: number, houseEdgeBps: number) =>
  payoutFor(perRound, 37, covered, houseEdgeBps);

/** What one round pays per unit staked. */
export const rouletteMultiplier = (covered: number, houseEdgeBps: number) =>
  multiplierFor(37, covered, houseEdgeBps);

/** The win chance in percent, to one decimal: "48.6". */
export const rouletteChance = (covered: number) => ((covered / 37) * 100).toFixed(1);

/** The spot whose chip a win is paid on: the first placed spot that covers the number. */
export function winningSpot(spots: readonly string[], value: number): string | undefined {
  return spots.find((key) => SPOT_BY_KEY.get(key)?.numbers.includes(value));
}

/** Whether these chips are the bet that covered exactly these numbers. */
export function spotsMatch(spots: readonly string[], numbers: readonly number[]) {
  const covered = rouletteCoveredNumbers(spots);
  return covered.length === numbers.length && covered.every((n, i) => n === numbers[i]);
}
