import { describe, expect, it } from "vitest";

import {
  formatGameMaxPayout,
  formatHouseEdge,
  getGameDisplayName,
  getGameThemeColor
} from "./presentation";

describe("game room presentation helpers", () => {
  it("keeps legacy per-game theme mapping centralized", () => {
    expect(getGameThemeColor("dice")).toBe("purple");
    expect(getGameThemeColor("roulette")).toBe("emerald");
    expect(getGameThemeColor("coin-toss")).toBe("amber");
    expect(getGameThemeColor("keno")).toBe("fuchsia");
  });

  it("formats display names and house edge fallbacks", () => {
    expect(
      getGameDisplayName({
        gameId: "0x1111111111111111111111111111111111111111",
        slug: "dice",
        label: "Dice",
        module: "0x2222222222222222222222222222222222222222"
      })
    ).toBe("Precision Dice");
    expect(formatHouseEdge(undefined, "roulette")).toBe("2.70%");
    expect(formatHouseEdge({ houseEdgeBps: 150 }, "dice")).toBe("1.50%");
  });

  it("formats release max payout or legacy fallback", () => {
    expect(
      formatGameMaxPayout({ gameMeta: { maxPayout: "2500000000" }, slug: "dice", usdcDecimals: 6 })
    ).toBe("2,500 USDC");
    expect(formatGameMaxPayout({ gameMeta: undefined, slug: "keno", usdcDecimals: 6 })).toBe(
      "500,000 USDC"
    );
  });
});
