import {
  decodeBaccaratParams,
  decodeCoinTossParams,
  decodeDiceParams,
  decodeKenoParams,
  decodePlinkoParams,
  decodeRouletteParams,
  decodeSicBoParams,
  decodeSlotsParams
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
    expect(
      calculateGameWinChance({
        slug: "slots",
        diceTarget: 50,
        diceDirection: "under",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium"
      })
    ).toBeCloseTo(34.375);
    expect(
      calculateGameWinChance({
        slug: "baccarat",
        diceTarget: 50,
        diceDirection: "under",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium",
        baccaratSide: "banker"
      })
    ).toBeCloseTo((2_212_744 / 4_826_809) * 100);
    expect(
      calculateGameWinChance({
        slug: "sic-bo",
        diceTarget: 50,
        diceDirection: "under",
        rouletteSpots: [],
        kenoSpots: [],
        plinkoRisk: "medium",
        sicBoKind: "small",
        sicBoValue: 0
      })
    ).toBeCloseTo((105 / 216) * 100);
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
    expect(createRouletteParamsInput(["col2"])).toEqual({ kind: "column", column: 2 });
    expect(createRouletteParamsInput([])).toBeNull();
  });

  it("computes Roulette coverage as a true set union (order-independent)", () => {
    // ODD ∪ BLACK = 18 odds + 18 blacks − 8 (numbers that are both odd and
    // black) = 28 covered. Selection order must not change that.
    const oddThenBlack = rouletteCoveredNumbers(["ODD", "BLACK"]);
    const blackThenOdd = rouletteCoveredNumbers(["BLACK", "ODD"]);
    expect(oddThenBlack).toEqual(blackThenOdd);
    expect(oddThenBlack.length).toBe(28);

    // RED + BLACK must cover all 36 non-zero numbers regardless of order —
    // a regression for the same "delete red after add 1..36" bug.
    expect(rouletteCoveredNumbers(["RED", "BLACK"]).length).toBe(36);
    expect(rouletteCoveredNumbers(["BLACK", "RED"]).length).toBe(36);

    // Bitmasks (which is what actually gets sent on-chain) must agree too.
    expect(buildRouletteBitmask(["ODD", "BLACK"])).toBe(buildRouletteBitmask(["BLACK", "ODD"]));
  });

  it("expands column bets to the 12 numbers they cover", () => {
    expect(rouletteCoveredNumbers(["col1"])).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
    expect(rouletteCoveredNumbers(["col2"])).toEqual([2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]);
    expect(rouletteCoveredNumbers(["col3"])).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);
  });

  it("encodes column bets through the SSOT column kind", () => {
    const roulette = buildGameParams({
      slug: "roulette",
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: ["col3"],
      kenoSpots: [],
      plinkoRisk: "medium"
    });
    expect(roulette.ok && decodeRouletteParams(roulette.params)).toEqual({
      kind: "column",
      column: 3
    });
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
      kenoSpots: [1, 15],
      plinkoRisk: "medium"
    });
    expect(keno.ok && decodeKenoParams(keno.params)).toEqual({ mask: buildKenoMask([1, 15]) });

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

    const slots = buildGameParams({
      slug: "slots",
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium"
    });
    expect(slots.ok && decodeSlotsParams(slots.params)).toEqual({
      profile: "classic",
      profileId: 0
    });

    const baccarat = buildGameParams({
      slug: "baccarat",
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium",
      baccaratSide: "tie"
    });
    expect(baccarat.ok && decodeBaccaratParams(baccarat.params)).toEqual({
      side: "tie",
      sideId: 2
    });

    const sicBo = buildGameParams({
      slug: "sic-bo",
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium",
      sicBoKind: "total",
      sicBoValue: 12
    });
    expect(sicBo.ok && decodeSicBoParams(sicBo.params)).toEqual({
      kind: "total",
      kindId: 4,
      value: 12
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

  it("rejects Keno spots outside the 15-pick board contract", () => {
    expect(
      buildGameParams({
        slug: "keno",
        diceTarget: 50,
        diceDirection: "under",
        coinSide: "HEADS",
        rouletteSpots: [],
        kenoSpots: [1, 2, 3, 4, 5, 6],
        plinkoRisk: "medium",
        messages: {
          kenoSelectionInvalid: "Invalid Keno selection"
        }
      })
    ).toEqual({ ok: false, message: "Invalid Keno selection" });

    expect(
      buildGameParams({
        slug: "keno",
        diceTarget: 50,
        diceDirection: "under",
        coinSide: "HEADS",
        rouletteSpots: [],
        kenoSpots: [16],
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
