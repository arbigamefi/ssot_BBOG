import { describe, expect, it } from "vitest";

import { CASINO_MODULE_SLUGS } from "../casino/modules";
import { ticketMultiplier } from "./game-multipliers";

const printed = (slug: (typeof CASINO_MODULE_SLUGS)[number], bps = 200) => {
  const { value, fixed } = ticketMultiplier(slug, bps);
  return `${fixed ? "" : "up to "}${value.whole}${value.fraction ? `.${value.fraction}` : ""}×`;
};

describe("ticketMultiplier", () => {
  it("prints each game's top multiplier after a 2% house edge, rounded down", () => {
    expect(Object.fromEntries(CASINO_MODULE_SLUGS.map((slug) => [slug, printed(slug)]))).toEqual({
      "coin-toss": "1.96×",
      dice: "up to 49×",
      roulette: "up to 36.26×",
      baccarat: "up to 10.26×",
      "sic-bo": "up to 211.68×",
      slots: "up to 62.72×",
      plinko: "up to 24.12×",
      keno: "up to 490.49×"
    });
  });

  it("follows the release's house edge", () => {
    expect(printed("coin-toss", 0)).toBe("2×");
    expect(printed("dice", 100)).toBe("up to 49.5×");
  });
});
