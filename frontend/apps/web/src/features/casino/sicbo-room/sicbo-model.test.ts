import { encodeSicBoParams } from "@ssot/ssot/encoding";
import type { DomainBet } from "@ssot/ssot";
import { describe, expect, it } from "vitest";

import { deriveCasinoOutcome } from "../room/outcome";
import {
  areaChance,
  areaMultiplier,
  factorOf,
  multiplierText,
  payoutFor,
  ROWS,
  type Area,
  type Dice
} from "./sicbo-model";

const bet: DomainBet = {
  betId: 21n,
  chainId: 84532,
  gameId: "0x00",
  asset: "0x0000000000000000000000000000000000000001",
  bank: "0x0000000000000000000000000000000000000002",
  player: "0x0000000000000000000000000000000000000003",
  stake: 5_000_000n,
  reserved: 30_000_000n,
  amountPerRoll: 1_000_000n,
  betCount: 5,
  stopGain: 0n,
  stopLoss: 0n,
  houseEdgeBps: 200,
  vrfFeePaid: 10n,
  vrfFeeCharged: 10n,
  vrfCallbackGasLimit: 320_000,
  requestId: 99n,
  randomHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  state: "finalized",
  refundDeadline: 3601,
  placedAt: 1
};

const AREAS = ROWS.flatMap((row) => row.areas);
const pays = (area: Area, dice = 1) => multiplierText(areaMultiplier(area, 200, dice));
const ALL_DICE: Dice[] = [];
for (let a = 1; a <= 6; a++)
  for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) ALL_DICE.push([a, b, c]);

describe("the sic bo layout", () => {
  it("prints every area of a real table, in its four rows", () => {
    expect(ROWS.map((row) => row.areas.length)).toEqual([3, 12, 14, 6]);
    expect(new Set(AREAS.map((area) => `${area.kind}:${area.value}`)).size).toBe(35);
  });

  it("prints what each area pays after a 2% edge, and its win chance", () => {
    expect(pays({ kind: "small", value: 0 })).toBe("2.01");
    expect(pays({ kind: "big", value: 0 })).toBe("2.01");
    expect(pays({ kind: "anyTriple", value: 0 })).toBe("35.28");
    expect(pays({ kind: "specificTriple", value: 4 })).toBe("211.68");
    expect(pays({ kind: "specificDouble", value: 2 })).toBe("13.23");
    expect(pays({ kind: "total", value: 4 })).toBe("70.56");
    expect(pays({ kind: "total", value: 17 })).toBe("70.56");
    expect(pays({ kind: "total", value: 10 })).toBe("7.84");
    expect([1, 2, 3].map((n) => pays({ kind: "singleFace", value: 5 }, n))).toEqual([
      "1.96",
      "3.92",
      "5.88"
    ]);
    expect(areaChance({ kind: "small", value: 0 })).toBe("48.6");
    expect(areaChance({ kind: "anyTriple", value: 0 })).toBe("2.8");
    expect(areaChance({ kind: "specificTriple", value: 6 })).toBe("0.46");
    expect(areaChance({ kind: "specificDouble", value: 1 })).toBe("7.4");
    expect(areaChance({ kind: "total", value: 4 })).toBe("1.4");
    expect(areaChance({ kind: "singleFace", value: 3 })).toBe("42.1");
  });

  it("wins each area on exactly as many of the 216 throws as its chance says", () => {
    for (const area of AREAS) {
      const wins = ALL_DICE.filter((dice) => factorOf(area, dice) > 0).length;
      expect(((wins / 216) * 100).toFixed(area.kind === "specificTriple" ? 2 : 1)).toBe(
        areaChance(area)
      );
    }
    // Small and Big lose on a triple.
    expect(factorOf({ kind: "small", value: 0 }, [2, 2, 2])).toBe(0);
    expect(factorOf({ kind: "big", value: 0 }, [5, 5, 5])).toBe(0);
  });

  it("pays what SicBoModule pays: the same factor for every roll, for every area", () => {
    for (const area of AREAS) {
      for (let seed = 1n; seed <= 6n; seed++) {
        const outcome = deriveCasinoOutcome({
          bet,
          gameSlug: "sic-bo",
          params: encodeSicBoParams({ kind: area.kind, value: area.value }),
          randomWords: [seed * 104_729n]
        });
        if (outcome?.kind !== "sic-bo") throw new Error("not sic bo");
        expect(outcome.betKind).toBe(area.kind);
        let gross = 0n;
        for (const roll of outcome.rolls) {
          expect(roll.factorBps).toBe(factorOf(area, roll.dice));
          gross += (bet.amountPerRoll * BigInt(roll.factorBps)) / 10_000n;
        }
        expect(outcome.payoutGross).toBe(gross);
      }
    }
  });

  it("takes the edge off the gross, floored", () => {
    // 1 USDC on Small: 2.0571 gross, less 2% of it.
    expect(payoutFor(1_000_000n, 20_571, 200)).toBe(2_057_100n - 41_142n);
  });
});
