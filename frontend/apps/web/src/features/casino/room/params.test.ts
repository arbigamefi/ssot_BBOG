import {
  decodeCoinTossParams,
  decodeDiceParams,
  decodeKenoParams,
  decodePlinkoParams,
  decodeRouletteParams
} from "@ssot/ssot/encoding";
import { describe, expect, it } from "vitest";

import {
  buildGameParams,
  buildKenoMask,
  buildRouletteBitmask,
  calculateGameWinChance,
  createRouletteParamsInput,
  rouletteCoveredNumbers,
  rouletteWinChance
} from "./params";

describe("game room params", () => {
  it("calculates per-game visible win chance", () => {
    expect(
      calculateGameWinChance({
        slug: "dice",
        diceTarget: 42,
        diceDirection: "under",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium"
      })
    ).toBe(42);
    expect(
      calculateGameWinChance({
        slug: "dice",
        diceTarget: 42,
        diceDirection: "over",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium"
      })
    ).toBe(58);
    expect(
      calculateGameWinChance({
        slug: "coin-toss",
        diceTarget: 50,
        diceDirection: "under",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium"
      })
    ).toBe(50);
    expect(
      calculateGameWinChance({
        slug: "roulette",
        diceTarget: 50,
        diceDirection: "under",
        rouletteSpots: ["RED"],
        kenoSpots: [],
        plinkoRisk: "medium"
      })
    ).toBeCloseTo(18 * (100 / 37));
    expect(
      calculateGameWinChance({
        slug: "keno",
        diceTarget: 50,
        diceDirection: "under",
        rouletteSpots: [],
        kenoSpots: [1, 2, 3],
        plinkoRisk: "medium"
      })
    ).toBeGreaterThan(0);
    expect(
      calculateGameWinChance({
        slug: "plinko",
        diceTarget: 50,
        diceDirection: "under",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "high"
      })
    ).toBeCloseTo(28.90625);
  });

  it("normalizes Roulette covered numbers and chance", () => {
    expect(rouletteCoveredNumbers(["RED", "1"])).toEqual([
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
    ]);
    expect(rouletteCoveredNumbers(["BLACK"])).not.toContain(1);
    expect(rouletteCoveredNumbers(["BLACK"])).toContain(2);
    expect(rouletteWinChance(["0"])).toBeCloseTo(100 / 37);
  });

  it("creates typed Roulette params for single selections", () => {
    expect(createRouletteParamsInput(["RED"])).toEqual({ kind: "red" });
    expect(createRouletteParamsInput(["2nd 12"])).toEqual({ kind: "dozen", dozen: 2 });
    expect(createRouletteParamsInput(["17"])).toEqual({ kind: "straight", number: 17 });
    expect(createRouletteParamsInput([])).toBeNull();
  });

  it("creates Roulette bitmasks for mixed selections", () => {
    const mask = buildRouletteBitmask(["0", "RED"]);
    expect(mask & 1n).toBe(1n);
    expect(mask & (1n << 1n)).toBe(1n << 1n);
    expect(createRouletteParamsInput(["0", "RED"])).toEqual({ kind: "bitmask", mask });
  });

  it("builds encoded params through the SSOT encoding package", () => {
    const dice = buildGameParams({
      slug: "dice",
      diceTarget: 55,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium"
    });
    expect(dice.ok && decodeDiceParams(dice.params)).toEqual({
      cap: 55,
      direction: "under",
      target: 55
    });

    const coin = buildGameParams({
      slug: "coin-toss",
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "TAILS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium"
    });
    expect(coin.ok && decodeCoinTossParams(coin.params)).toEqual({ face: true });

    const roulette = buildGameParams({
      slug: "roulette",
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: ["1st 12"],
      kenoSpots: [],
      plinkoRisk: "medium"
    });
    expect(roulette.ok && decodeRouletteParams(roulette.params)).toEqual({
      kind: "dozen",
      dozen: 1
    });

    const keno = buildGameParams({
      slug: "keno",
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [1, 40],
      plinkoRisk: "medium"
    });
    expect(keno.ok && decodeKenoParams(keno.params)).toEqual({ mask: buildKenoMask([1, 40]) });

    const plinko = buildGameParams({
      slug: "plinko",
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "high"
    });
    expect(plinko.ok && decodePlinkoParams(plinko.params)).toEqual({
      risk: "high",
      riskId: 2
    });
  });

  it("uses neutral validation fallbacks when UI copy is not provided", () => {
    expect(
      buildGameParams({
        slug: "roulette",
        diceTarget: 50,
        diceDirection: "under",
        coinSide: "HEADS",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium"
      })
    ).toEqual({
      ok: false,
      message: "—"
    });
    expect(
      buildGameParams({
        slug: "keno",
        diceTarget: 50,
        diceDirection: "under",
        coinSide: "HEADS",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium"
      })
    ).toEqual({ ok: false, message: "—" });
  });

  it("allows UI layers to provide localized validation copy", () => {
    expect(
      buildGameParams({
        slug: "roulette",
        diceTarget: 50,
        diceDirection: "under",
        coinSide: "HEADS",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium",
        messages: {
          rouletteSelectionRequired: "请选择至少一个轮盘投注项。"
        }
      })
    ).toEqual({
      ok: false,
      message: "请选择至少一个轮盘投注项。"
    });
  });
});
