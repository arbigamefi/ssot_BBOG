import { describe, expect, it } from "vitest";

import { CASINO_MODULE_SLUGS } from "./modules";
import { formatWinChance, winChanceRange } from "./win-chances";

describe("winChanceRange", () => {
  it("gives each game the lowest and highest win chance its room offers", () => {
    const printed = Object.fromEntries(
      CASINO_MODULE_SLUGS.map((slug) => [
        slug,
        winChanceRange(slug, 200).map((chance) => formatWinChance(chance, "en"))
      ])
    );
    expect(printed).toEqual({
      "coin-toss": ["50%", "50%"],
      dice: ["2%", "97%"],
      roulette: ["2.7%", "97.3%"],
      baccarat: ["9.5%", "45.8%"],
      "sic-bo": ["0.46%", "48.6%"],
      slots: ["34.4%", "34.4%"],
      plinko: ["28.9%", "28.9%"],
      keno: ["9.5%", "33.3%"]
    });
  });

  it("counts a keno win as a payout above the stake after the house edge", () => {
    // One pick that hits pays 1.5× gross: above the stake at a 2% edge (1001 of 3003 draws hit
    // it), not at a 40% one.
    expect(winChanceRange("keno", 200)[1]).toBeCloseTo((1001 / 3003) * 100, 6);
    expect(winChanceRange("keno", 4000)[1]).toBeLessThan(winChanceRange("keno", 200)[1]);
  });

  it("formats in the reader's locale", () => {
    expect(formatWinChance(100 / 37, "pt-BR")).toBe("2,7%");
    expect(formatWinChance(100 / 37, "tr")).toBe("%2,7");
  });
});
