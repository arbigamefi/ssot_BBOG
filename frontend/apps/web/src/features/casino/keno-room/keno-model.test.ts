import { describe, expect, it } from "vitest";

import { KENO_GAIN_TABLE } from "@ssot/ssot/keno-gains";

import {
  bestHits,
  hitMultiplier,
  hitOdds,
  hitsOf,
  kenoChance,
  kenoGross,
  kenoPayout,
  OUTCOMES,
  paysMore,
  ways
} from "./keno-model";

const text = ({ whole, fraction }: { whole: string; fraction: string }) => `${whole}.${fraction}`;

describe("the keno model", () => {
  it("counts every draw once for every number of picks", () => {
    expect(OUTCOMES).toBe(3003);
    for (let picked = 1; picked <= 5; picked++) {
      let total = 0;
      for (let hits = 0; hits <= picked; hits++) total += ways(picked, hits);
      expect(total).toBe(3003);
    }
  });

  it("is fair before the house edge, as the contract's table is", () => {
    for (let picked = 1; picked <= 5; picked++) {
      let expected = 0;
      for (let hits = 0; hits <= picked; hits++)
        expected += ways(picked, hits) * KENO_GAIN_TABLE[picked]![hits]!;
      expect(expected / 3003 / 10_000).toBeCloseTo(1, 2);
    }
  });

  it("pays floor(stake × gain / 10000), less the house edge on it", () => {
    expect(kenoGross(1_000_000n, 3, 3)).toBe(11_375_000n);
    expect(kenoPayout(1_000_000n, 3, 3, 200)).toBe(11_147_500n);
    expect(kenoGross(3n, 5, 1)).toBe(1n);
    expect(kenoPayout(10_000n, 5, 0, 200)).toBe(19_464n);
    expect(text(hitMultiplier(3, 3, 200))).toBe("11.14");
    expect(text(hitMultiplier(5, 1, 200))).toBe("0.46");
  });

  it("counts a net win only when more than the stake comes back", () => {
    expect(paysMore(3, 1, 200)).toBe(false);
    expect(paysMore(3, 2, 200)).toBe(true);
    expect(paysMore(5, 0, 200)).toBe(true);
    expect(kenoChance(3, 200)).toBe("24.2");
    expect(kenoChance(0, 200)).toBe("0.0");
  });

  it("gives the odds of each number of hits", () => {
    expect(hitOdds(3, 0)).toEqual({ kind: "percent", value: "26.4" });
    expect(hitOdds(5, 5)).toEqual({ kind: "oneIn", value: 3003 });
    expect(hitsOf([4, 7, 11], [1, 4, 7, 9, 12])).toBe(2);
    expect(bestHits(3, [1, 3, 0])).toBe(3);
  });
});
