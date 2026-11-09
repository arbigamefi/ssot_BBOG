import { describe, expect, it } from "vitest";

import { rouletteCoveredNumbers } from "../room/params";
import {
  betNames,
  numberRuns,
  pocketColour,
  ROULETTE_SPOTS,
  rouletteChance,
  rouletteMultiplier,
  roulettePayout,
  rouletteSelection,
  rouletteSpot,
  spotsMatch,
  winningSpot
} from "./roulette-model";

describe("the roulette layout", () => {
  it("prints every spot the bet encoding knows, once, covering what the encoding covers", () => {
    expect(ROULETTE_SPOTS).toHaveLength(37 + 3 + 6 + 3);
    expect(new Set(ROULETTE_SPOTS.map((spot) => spot.key)).size).toBe(ROULETTE_SPOTS.length);
    for (const spot of ROULETTE_SPOTS) {
      expect(spot.numbers).toEqual(rouletteCoveredNumbers([spot.key]));
    }
  });

  it("puts 0 on the left, 3 to 36 along the top row and the columns at the right end", () => {
    expect(rouletteSpot("0")).toMatchObject({ row: "1 / span 3", column: "1" });
    expect(rouletteSpot("3")).toMatchObject({ row: "1", column: "2" });
    expect(rouletteSpot("1")).toMatchObject({ row: "3", column: "2" });
    expect(rouletteSpot("36")).toMatchObject({ row: "1", column: "13" });
    expect(rouletteSpot("col3")).toMatchObject({ row: "1", column: "14" });
    expect(rouletteSpot("col3")!.numbers).toContain(36);
    expect(rouletteSpot("2nd 12")).toMatchObject({ row: "4", column: "6 / span 4" });
    expect(rouletteSpot("19-36")).toMatchObject({ row: "5", column: "12 / span 2" });
  });

  it("colours zero green and the rest red or black", () => {
    expect(pocketColour(0)).toBe("zero");
    expect(pocketColour(32)).toBe("red");
    expect(pocketColour(15)).toBe("black");
  });
});

describe("the roulette bet", () => {
  it("names outside bets first, then numbers; past four, three and a count", () => {
    expect(betNames(["RED"])).toEqual({ names: [{ key: "red" }], more: 0 });
    expect(betNames(["20", "1st 12", "17"])).toEqual({
      names: [
        { key: "dozen", from: 1, to: 12 },
        { key: "number", n: 17 },
        { key: "number", n: 20 }
      ],
      more: 0
    });
    expect(betNames(["5", "4", "3", "2", "1"])).toEqual({
      names: [
        { key: "number", n: 1 },
        { key: "number", n: 2 },
        { key: "number", n: 3 }
      ],
      more: 2
    });
  });

  it("prints the covered numbers as runs", () => {
    expect(numberRuns([9, 1, 2, 3, 7, 8, 12, 14, 15])).toBe("1–3, 7–9, 12, 14, 15");
    expect(numberRuns([0])).toBe("0");
  });

  it("pays 37 over the numbers covered, less the release's edge, floored twice", () => {
    // 1 USDC on red: floor(1e6·37/18) = 2_055_555, less floor(2_055_555·200/10_000) = 41_111.
    expect(roulettePayout(1_000_000n, 18, 200)).toBe(2_014_444n);
    // A straight-up number at a 1.5% edge: 37_000_000 less 555_000.
    expect(roulettePayout(1_000_000n, 1, 150)).toBe(36_445_000n);
    expect(rouletteMultiplier(18, 200)).toEqual({ whole: "2", fraction: "01", sign: "" });
    expect(rouletteChance(18)).toBe("48.6");
  });

  it("needs at least one number and not all 37", () => {
    expect(rouletteSelection(0)).toBe("empty");
    expect(rouletteSelection(37)).toBe("all");
    expect(rouletteSelection(12)).toBeUndefined();
  });

  it("pays a win on the first chip that covered the number", () => {
    expect(winningSpot(["RED", "1st 12"], 3)).toBe("RED");
    expect(winningSpot(["BLACK", "1st 12"], 3)).toBe("1st 12");
    expect(winningSpot(["BLACK"], 3)).toBeUndefined();
  });

  it("knows whether chips on the table are the bet that settled", () => {
    expect(spotsMatch(["1st 12"], rouletteCoveredNumbers(["1st 12"]))).toBe(true);
    expect(spotsMatch(["RED"], rouletteCoveredNumbers(["BLACK"]))).toBe(false);
  });
});
