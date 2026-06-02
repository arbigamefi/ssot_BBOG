import { describe, expect, it } from "vitest";

import { formatGameMaxPayout, formatHouseEdge } from "./presentation";

describe("game room presentation helpers", () => {
  it("formats house edge fallbacks", () => {
    expect(formatHouseEdge(undefined, "roulette")).toBe("2.70%");
    expect(formatHouseEdge({ houseEdgeBps: 150 }, "dice")).toBe("1.50%");
  });

  it("formats release max payout or catalog fallback", () => {
    expect(
      formatGameMaxPayout({
        assetDecimals: 6,
        assetSymbol: "USDC",
        gameMeta: { maxPayout: "2500000000" },
        slug: "dice"
      })
    ).toBe("2,500 USDC");
    expect(
      formatGameMaxPayout({
        assetDecimals: 18,
        assetSymbol: "WETH",
        gameMeta: undefined,
        slug: "keno"
      })
    ).toBe("500,000 WETH");
  });
});
