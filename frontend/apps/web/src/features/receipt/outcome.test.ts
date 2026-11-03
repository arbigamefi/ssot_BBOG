import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import type { CasinoOutcome } from "@ssot/ssot/domain";

import en from "../../i18n/locales/en/common.json";
import zh from "../../i18n/locales/zh-Hans/common.json";
import { describeOutcome } from "./outcome";

const money = {
  payoutGross: 0n,
  payoutNet: 0n,
  refundAmount: 0n,
  feeOnPayout: 0n,
  playerOwed: 0n,
  netResult: 0n
};
const tEn = createTranslator({ locale: "en", messages: en }) as never;
const tZh = createTranslator({ locale: "zh-Hans", messages: zh }) as never;

describe("describeOutcome", () => {
  it("prints a dice bet's winning range and every roll", () => {
    const outcome: CasinoOutcome = {
      ...money,
      kind: "dice",
      direction: "over",
      target: 5,
      rolls: [
        { value: 66, won: true },
        { value: 3, won: false },
        { value: 30, won: true }
      ]
    };
    expect(describeOutcome(outcome, tEn, "en")).toEqual([
      "6–100 wins.",
      "Rolled 66, 3, and 30.",
      "2 of 3 rounds won."
    ]);
    expect(describeOutcome(outcome, tZh, "zh-Hans")).toEqual([
      "6–100 为赢。",
      "掷出 66、3和30。",
      "3 局赢 2 局。"
    ]);
  });

  it("leaves the round count out of a single round", () => {
    const outcome: CasinoOutcome = {
      ...money,
      kind: "coin-toss",
      chosen: "HEADS",
      rolls: [{ value: "TAILS", won: false }]
    };
    expect(describeOutcome(outcome, tEn, "en")).toEqual(["Called Heads, landed Tails."]);
  });

  it("counts a roulette bet's numbers instead of listing a long cover", () => {
    const outcome: CasinoOutcome = {
      ...money,
      kind: "roulette",
      selectedNumbers: [1, 3, 5, 7, 9, 12, 14],
      rolls: [{ value: 17, won: false }]
    };
    expect(describeOutcome(outcome, tEn, "en")).toEqual(["On 7 numbers.", "Landed on 17."]);
  });

  it("prints a keno draw's hits, a baccarat hand and sic bo dice", () => {
    expect(
      describeOutcome(
        {
          ...money,
          kind: "keno",
          pickedNumbers: [4, 8],
          draws: [{ numbers: [4, 9, 11], hits: 1, won: false }]
        },
        tEn,
        "en"
      )
    ).toEqual(["Picked 4 and 8.", "Drew 4, 9, and 11: 1 hit."]);
    expect(
      describeOutcome(
        {
          ...money,
          kind: "baccarat",
          side: "banker",
          rolls: [
            {
              playerCards: [1, 2],
              bankerCards: [3, 4],
              playerTotal: 3,
              bankerTotal: 7,
              outcome: "banker",
              factorBps: 19_500,
              won: true
            }
          ]
        },
        tEn,
        "en"
      )
    ).toEqual(["Backed Banker.", "Banker won, player 3 to banker 7."]);
    expect(
      describeOutcome(
        {
          ...money,
          kind: "sic-bo",
          betKind: "total",
          betValue: 10,
          rolls: [
            { dice: [2, 3, 5], total: 10, triple: false, faceCount: 0, factorBps: 0, won: true }
          ]
        },
        tEn,
        "en"
      )
    ).toEqual(["Bet: Exact total 10.", "Rolled 2-3-5, total 10."]);
  });
});
