import { describe, expect, it } from "vitest";

import {
  lineMultiplier,
  lineOf,
  OUTCOMES,
  PAY_LINES,
  slotsChance,
  slotsMultiple,
  slotsPayout,
  winningReels,
  WINNING
} from "./slots-model";

const every = () => {
  const spins: number[][] = [];
  for (let a = 0; a < 8; a++)
    for (let b = 0; b < 8; b++) for (let c = 0; c < 8; c++) spins.push([a, b, c]);
  return spins;
};

describe("the slots pay table", () => {
  it("counts every line over all 512 spins, and is fair before the house edge", () => {
    const spins = every();
    expect(spins).toHaveLength(OUTCOMES);
    for (const line of PAY_LINES) {
      expect(spins.filter((spin) => lineOf(slotsMultiple(spin)) === line.key)).toHaveLength(
        line.count
      );
    }
    expect(WINNING).toBe(176);
    expect(spins.reduce((sum, spin) => sum + slotsMultiple(spin), 0)).toBe(OUTCOMES);
    expect(slotsChance()).toBe("34.4");
  });

  it("pays as SlotsModule does: 777 64x, other three alike 16x, two alike 2x", () => {
    expect(slotsMultiple([7, 7, 7])).toBe(64);
    expect(slotsMultiple([0, 0, 0])).toBe(16);
    expect(slotsMultiple([7, 7, 3])).toBe(2);
    expect(slotsMultiple([4, 1, 4])).toBe(2);
    expect(slotsMultiple([2, 5, 5])).toBe(2);
    expect(slotsMultiple([0, 1, 2])).toBe(0);
  });

  it("lights the reels that make a win", () => {
    expect(winningReels([3, 3, 3])).toEqual([0, 1, 2]);
    expect(winningReels([3, 3, 1])).toEqual([0, 1]);
    expect(winningReels([3, 1, 3])).toEqual([0, 2]);
    expect(winningReels([1, 3, 3])).toEqual([1, 2]);
    expect(winningReels([1, 2, 3])).toEqual([]);
  });

  it("takes the release's house edge off the gross, floored", () => {
    expect(slotsPayout(1_000_000n, 64, 200)).toBe(62_720_000n);
    expect(slotsPayout(1_000_000n, 2, 200)).toBe(1_960_000n);
    expect(slotsPayout(333n, 16, 250)).toBe(5328n - (5328n * 250n) / 10_000n);
    expect(lineMultiplier(64, 200)).toEqual({ whole: "62", fraction: "72", sign: "" });
    expect(lineMultiplier(16, 200)).toEqual({ whole: "15", fraction: "68", sign: "" });
    expect(lineMultiplier(2, 200)).toEqual({ whole: "1", fraction: "96", sign: "" });
    expect(lineMultiplier(2, 150)).toEqual({ whole: "1", fraction: "97", sign: "" });
  });
});
