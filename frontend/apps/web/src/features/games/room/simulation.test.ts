import { describe, expect, it } from "vitest";

import { RED_NUMBER_SET } from "./model";
import { simulateGameResult } from "./simulation";

const baseInput = {
  coinSide: "HEADS" as const,
  diceDirection: "under" as const,
  diceTarget: 50,
  rouletteSpots: [],
  kenoSpots: []
};

describe("game room simulation", () => {
  it("simulates coin toss faces from selected side and win state", () => {
    expect(simulateGameResult({ ...baseInput, slug: "coin-toss", win: true })).toEqual({
      value: 1,
      flipCoin: true
    });
    expect(simulateGameResult({ ...baseInput, slug: "coin-toss", win: false })).toEqual({
      value: 0,
      flipCoin: true
    });
    expect(
      simulateGameResult({ ...baseInput, slug: "coin-toss", win: true, coinSide: "TAILS" })
    ).toEqual({ value: 0, flipCoin: true });
  });

  it("keeps dice animation results on the correct side of the target", () => {
    expect(
      simulateGameResult({
        ...baseInput,
        slug: "dice",
        win: true,
        diceDirection: "under",
        diceTarget: 50,
        rng: () => 0.98
      }).value
    ).toBeLessThan(50);
    expect(
      simulateGameResult({
        ...baseInput,
        slug: "dice",
        win: false,
        diceDirection: "under",
        diceTarget: 50,
        rng: () => 0
      }).value
    ).toBeGreaterThanOrEqual(50);
  });

  it("uses full Roulette covered numbers for named bets", () => {
    const win = simulateGameResult({
      ...baseInput,
      slug: "roulette",
      win: true,
      rouletteSpots: ["RED"],
      rng: () => 0
    });
    expect(RED_NUMBER_SET.has(win.value)).toBe(true);

    const loss = simulateGameResult({
      ...baseInput,
      slug: "roulette",
      win: false,
      rouletteSpots: ["RED"],
      rng: () => 0
    });
    expect(RED_NUMBER_SET.has(loss.value)).toBe(false);
  });

  it("simulates Keno drawn numbers and hit count", () => {
    const result = simulateGameResult({
      ...baseInput,
      slug: "keno",
      win: true,
      kenoSpots: [1, 2, 3, 4, 5],
      rng: () => 0
    });

    expect(result.kenoDrawn).toHaveLength(10);
    expect(result.value).toBeGreaterThan(0);
  });
});
