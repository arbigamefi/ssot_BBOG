import type { BaccaratSide, PlinkoRisk, SicBoKind } from "@ssot/ssot/encoding";

import type { CasinoModuleSlug } from "./modules";
import { kenoWinChance } from "./room/model";
import {
  SIC_BO_TOTAL_COUNTS,
  baccaratWinChance,
  diceTargetBounds,
  plinkoPositiveChance,
  sicBoWinChance,
  slotsPositiveChance
} from "./room/payouts";

const PLINKO_RISKS: readonly PlinkoRisk[] = ["low", "medium", "high"];
const BACCARAT_SIDES: readonly BaccaratSide[] = ["player", "banker", "tie"];
const SIC_BO_BETS: ReadonlyArray<readonly [SicBoKind, number]> = [
  ["small", 0],
  ["big", 0],
  ["anyTriple", 0],
  ["specificTriple", 1],
  ["specificDouble", 1],
  ["singleFace", 1],
  ...Object.keys(SIC_BO_TOTAL_COUNTS).map((total) => ["total", Number(total)] as const)
];

function span(chances: readonly number[]): readonly [number, number] {
  return [Math.min(...chances), Math.max(...chances)];
}

/**
 * The lowest and highest win chance, in percent, of the bets a game's room offers. Each figure is
 * the one the room itself shows next to the bet.
 */
export function winChanceRange(slug: CasinoModuleSlug): readonly [number, number] {
  switch (slug) {
    case "dice":
      // Under a line t wins on 1..t, so the line is the chance.
      return diceTargetBounds("under");
    case "coin-toss":
      return [50, 50];
    case "roulette":
      // One number up to 36: the module rejects a bet on all 37.
      return [100 / 37, 3600 / 37];
    case "keno":
      return span([1, 2, 3, 4, 5].map(kenoWinChance));
    case "plinko":
      return span(PLINKO_RISKS.map(plinkoPositiveChance));
    case "slots":
      return [slotsPositiveChance(), slotsPositiveChance()];
    case "baccarat":
      return span(BACCARAT_SIDES.map(baccaratWinChance));
    case "sic-bo":
      return span(SIC_BO_BETS.map(([kind, value]) => sicBoWinChance(kind, value)));
  }
}

/** A win chance as the lobby prints it: one decimal, two under 1%. */
export function formatWinChance(percent: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: percent < 1 ? 2 : 1
  }).format(percent / 100);
}
