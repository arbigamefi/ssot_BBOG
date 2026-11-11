import { describe, expect, it } from "vitest";

import { PLINKO_FACTOR_TABLE } from "../room/payouts";
import {
  bestCup,
  cupFigure,
  cupMultiplier,
  cupOdds,
  CUP_LIST,
  pathBits,
  paysMore,
  plinkoChance,
  plinkoGross,
  plinkoPayout,
  RISKS,
  WEIGHTS
} from "./plinko-model";

const text = ({ whole, fraction }: { whole: string; fraction: string }) =>
  fraction ? `${whole}.${fraction}` : whole;

describe("the plinko model", () => {
  it("counts every one of the 256 paths once", () => {
    expect(WEIGHTS.reduce((a, b) => a + b, 0)).toBe(256);
    expect(CUP_LIST.map(cupOdds)).toEqual([
      "0.4",
      "3.1",
      "10.9",
      "21.9",
      "27.3",
      "21.9",
      "10.9",
      "3.1",
      "0.4"
    ]);
  });

  it("is close to fair before the house edge at every risk, as the module's table is", () => {
    for (const risk of RISKS) {
      const expected = CUP_LIST.reduce(
        (sum, cup) => sum + WEIGHTS[cup]! * PLINKO_FACTOR_TABLE[risk][cup]!,
        0
      );
      expect(expected / 256 / 10_000).toBeCloseTo(1, 2);
    }
  });

  it("pays floor(stake × factor / 10000), less the house edge on it", () => {
    expect(plinkoGross(1_000_000n, "medium", 1)).toBe(3_446_400n);
    expect(plinkoPayout(1_000_000n, "medium", 1, 200)).toBe(3_377_472n);
    expect(plinkoPayout(1_000_000n, "high", 4, 200)).toBe(0n);
    expect(plinkoPayout(3n, "low", 0, 200)).toBe(4n);
  });

  it("quotes cut down to two decimals, and the cups to three figures", () => {
    expect(CUP_LIST.map((cup) => text(cupMultiplier("medium", cup, 200)))).toEqual([
      "8.10",
      "3.37",
      "1.62",
      "0.67",
      "0.20",
      "0.67",
      "1.62",
      "3.37",
      "8.10"
    ]);
    expect(text(cupMultiplier("high", 0, 200))).toBe("24.12");
    expect(text(cupFigure("high", 0, 200))).toBe("24.1");
    expect(text(cupFigure("high", 1, 200))).toBe("6.03");
    expect(text(cupFigure("high", 4, 200))).toBe("0.00");
  });

  it("wins in the outer six cups at every risk: 28.9%", () => {
    for (const risk of RISKS) {
      expect(plinkoChance(risk, 200)).toBe("28.9");
      expect(CUP_LIST.map((cup) => paysMore(risk, cup, 200))).toEqual([
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        true
      ]);
    }
  });

  it("reads paths and picks the best cup of several balls", () => {
    expect(pathBits(["L", "R", "R", "L", "R", "L", "R", "R"])).toEqual([
      false,
      true,
      true,
      false,
      true,
      false,
      true,
      true
    ]);
    expect(bestCup("medium", [4, 7, 3])).toBe(7);
    expect(bestCup("high", [4, 0, 8])).toBe(0);
  });
});
