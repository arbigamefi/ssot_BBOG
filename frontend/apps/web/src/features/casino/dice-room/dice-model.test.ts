import { describe, expect, it } from "vitest";

import { diceLoseRange, diceMultiplier, dicePayout, diceWinRange, diceWins } from "./dice-model";

describe("dice odds", () => {
  it("wins on the line or under it when low, and above it when high", () => {
    expect(diceWins("under", 50)).toBe(50);
    expect(diceWinRange("under", 50)).toEqual([1, 50]);
    expect(diceLoseRange("under", 50)).toEqual([51, 100]);
    expect(diceWins("over", 80)).toBe(20);
    expect(diceWinRange("over", 80)).toEqual([81, 100]);
    expect(diceLoseRange("over", 80)).toEqual([1, 80]);
  });

  it("pays as DiceModule and GameHub do: floor the gross, then floor the edge", () => {
    // Bet 5 on Base Sepolia: high over 5, 0.8 USDC.
    expect(dicePayout(800_000n, 95, 200)).toBe(825_263n);
    expect(dicePayout(1_000_000n, 50, 200)).toBe(1_960_000n);
    expect(dicePayout(1_000_000n, 0, 200)).toBe(0n);
  });

  it("quotes the multiplier cut to two decimals", () => {
    expect(diceMultiplier(50, 200)).toEqual({ sign: "", whole: "1", fraction: "96" });
    expect(diceMultiplier(3, 200)).toEqual({ sign: "", whole: "32", fraction: "66" });
  });
});
