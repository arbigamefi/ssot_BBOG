import { describe, expect, it } from "vitest";

import { formatGameMaxPayout, formatHouseEdge } from "./presentation";

describe("game room presentation helpers", () => {
  it("formats house edge fallbacks", () => {
    expect(formatHouseEdge(undefined, "roulette")).toBe("2.70%");
    expect(formatHouseEdge({ houseEdgeBps: 150 }, "dice")).toBe("1.50%");
  });

  it("formats release max payout or catalog fallback", () => {
    expect(
      formatGameMaxPayout({ gameMeta: { maxPayout: "2500000000" }, slug: "dice", usdcDecimals: 6 })
    ).toBe("2,500 USDC");
    expect(formatGameMaxPayout({ gameMeta: undefined, slug: "keno", usdcDecimals: 6 })).toBe(
      "500,000 USDC"
    );
  });
});
