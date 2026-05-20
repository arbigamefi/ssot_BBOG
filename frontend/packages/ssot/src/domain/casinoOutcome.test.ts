import { describe, expect, it } from "vitest";

import { KENO_GAIN_TABLE, kenoGainFactor, kenoMultiplier } from "./casinoOutcome";

// `C(n, r)` — exact enough in IEEE-754 for the N=15 keno domain.
function comb(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let result = 1;
  for (let i = 0; i < r; i += 1) result = (result * (n - i)) / (i + 1);
  return result;
}

// Hypergeometric P(matchCount) for `played` picks against a 5-of-15 draw.
function hypergeom(played: number, k: number): number {
  return (comb(played, k) * comb(15 - played, 5 - k)) / comb(15, 5);
}

describe("keno gain table", () => {
  // Spot-checks against `KenoModule.sol` `_gain(played, matchCount)`. If this
  // fails, the on-chain table moved — regenerate KENO_GAIN_TABLE from the
  // contract; do NOT edit these expectations to make the test pass.
  it("mirrors the KenoModule._gain contract table", () => {
    expect(KENO_GAIN_TABLE[1]).toEqual([7500, 15000]);
    expect(KENO_GAIN_TABLE[2]).toEqual([7777, 7000, 35000]);
    expect(KENO_GAIN_TABLE[5]).toEqual([19861, 4766, 4170, 11122, 100100, 5005000]);
  });

  it("has played+1 entries per row for played 1..5", () => {
    for (let played = 1; played <= 5; played += 1) {
      expect(KENO_GAIN_TABLE[played]).toHaveLength(played + 1);
    }
  });

  // Independent fairness check: the contract construction is
  // gainFactor = floor(10000 / (P(k) * (played+1))), so the gross expectation
  // sums to ~10000 (1.0x) before the GameHub fee-on-payout. Integer truncation
  // pulls it a hair below 10000. This is the assertion the previous, incorrect
  // table failed hardest — it had a double-digit edge baked into the module.
  it("has gross expectation ~1.0 before house edge", () => {
    for (let played = 1; played <= 5; played += 1) {
      let ev = 0;
      for (let k = 0; k <= played; k += 1) {
        ev += hypergeom(played, k) * kenoGainFactor(played, k);
      }
      expect(ev).toBeGreaterThan(9990);
      expect(ev).toBeLessThanOrEqual(10000);
    }
  });

  it("rejects out-of-range (played, matchCount)", () => {
    expect(kenoGainFactor(0, 0)).toBe(0);
    expect(kenoGainFactor(6, 1)).toBe(0);
    expect(kenoGainFactor(3, 4)).toBe(0);
    expect(kenoGainFactor(3, -1)).toBe(0);
  });

  it("kenoMultiplier is the gain factor in 1x units", () => {
    expect(kenoMultiplier(1, 1)).toBeCloseTo(1.5);
    expect(kenoMultiplier(2, 2)).toBeCloseTo(3.5);
    expect(kenoMultiplier(5, 5)).toBeCloseTo(500.5);
    expect(kenoMultiplier(0, 0)).toBe(0);
  });
});
