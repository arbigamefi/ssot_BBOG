import { describe, expect, it } from "vitest";

import { CASINO_MODULE_SLUGS } from "./modules";
import { formatWinChance, winChanceRange } from "./win-chances";

describe("winChanceRange", () => {
  it("gives each game the lowest and highest win chance its room offers", () => {
    const printed = Object.fromEntries(
      CASINO_MODULE_SLUGS.map((slug) => [
        slug,
        winChanceRange(slug).map((chance) => formatWinChance(chance, "en"))
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
      keno: ["33.3%", "91.6%"]
    });
  });

  it("formats in the reader's locale", () => {
    expect(formatWinChance(100 / 37, "pt-BR")).toBe("2,7%");
    expect(formatWinChance(100 / 37, "tr")).toBe("%2,7");
  });
});
