import type { CasinoModuleSlug } from "./modules";
import type { SignedAmount } from "../home/receipts";
import {
  applyHouseEdgeToMultiplier,
  baccaratMultiplier,
  diceTargetBounds,
  kenoMaxMultiplier,
  plinkoMaxMultiplier,
  sicBoMultiplier,
  slotsMaxMultiplier
} from "./room/payouts";

/** The most one bet can return, before the house edge, from the module rules the rooms use. */
function grossTopMultiplier(slug: CasinoModuleSlug): number {
  switch (slug) {
    case "dice":
      // The narrowest win chance the room offers.
      return 100 / diceTargetBounds("under")[0];
    case "coin-toss":
      return 2;
    case "roulette":
      return 37;
    case "keno":
      return Math.max(...[1, 2, 3, 4, 5].map(kenoMaxMultiplier));
    case "plinko":
      return Math.max(...(["low", "medium", "high"] as const).map(plinkoMaxMultiplier));
    case "slots":
      return slotsMaxMultiplier();
    case "baccarat":
      return Math.max(...(["player", "banker", "tie"] as const).map(baccaratMultiplier));
    case "sic-bo":
      return sicBoMultiplier("specificTriple", 1);
  }
}

/**
 * A ticket stub's figure: the top multiplier after the house edge, rounded down to two decimals
 * (what a player receives rounds down). Coin Toss pays one multiplier; the others pay "up to".
 */
export function ticketMultiplier(
  slug: CasinoModuleSlug,
  houseEdgeBps: number
): { value: SignedAmount; fixed: boolean } {
  const net = applyHouseEdgeToMultiplier(grossTopMultiplier(slug), houseEdgeBps);
  const hundredths = Math.floor(net * 100 + 1e-9);
  const whole = Math.floor(hundredths / 100);
  const fraction = String(hundredths % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return { value: { sign: "", whole: String(whole), fraction }, fixed: slug === "coin-toss" };
}
