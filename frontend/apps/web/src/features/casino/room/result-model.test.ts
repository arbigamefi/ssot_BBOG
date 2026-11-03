import { describe, expect, it } from "vitest";

import { buildCasinoReceiptFromTerminalResult } from "./result-model";
import type { CasinoTerminalRoundResult } from "./resolution";

const TX = "0x00000000000000000000000000000000000000000000000000000000000000aa";
const RANDOM = "0x00000000000000000000000000000000000000000000000000000000000000bb";
const PLAYER = "0x00000000000000000000000000000000000000cc";

describe("casino receipt view model", () => {
  it("normalizes terminal result facts for the in-room receipt modal", () => {
    const result: CasinoTerminalRoundResult = {
      betId: 42n,
      kind: "settled",
      player: PLAYER,
      randomHash: RANDOM,
      requestId: 77n,
      resolvedAt: 1_717_171_717,
      settlement: {
        payoutGross: 3_000_000n,
        payoutNet: 2_500_000n,
        refundAmount: 0n,
        txHash: TX
      },
      stake: 1_000_000n
    };

    const model = buildCasinoReceiptFromTerminalResult({
      assetDecimals: 6,
      assetSymbol: "USDC",
      chainId: 84532,

      gameLabel: "Plinko",
      gameSlug: "plinko",
      result
    });

    expect(model).toMatchObject({
      betId: "42",
      gameLabel: "Plinko",
      multiplierValue: "2.50x",
      netValue: "1.5 USDC",
      payoutValue: "2.5 USDC",
      shareText: "Plinko bet #42: + 1.5 USDC",
      signedNetValue: "+ 1.5 USDC",
      stakeValue: "1 USDC",
      state: "finalized",
      terminalTxHash: TX,
      tone: "win"
    });
  });
});

describe("receipt payment truthfulness", () => {
  const base = { assetDecimals: 6, assetSymbol: "USDC", gameLabel: "Dice", chainId: 84532 };
  const bet = { betId: 42n, requestId: 77n, player: PLAYER, randomHash: RANDOM } as const;
  it("carries the full refund's historical payable through a terminal result", () => {
    const model = buildCasinoReceiptFromTerminalResult({
      ...base,
      result: {
        ...bet,
        kind: "refunded",
        stake: 200000n,
        refund: { refundAmount: 200000n, payment: { status: "payable", amount: "200000" } }
      }
    });
    expect(model.payment).toEqual({ status: "payable", amount: "200000" });
    expect(model.net).toBe(0n);
  });
  it("leaves cash unknown when the evidence names another amount", () => {
    const model = buildCasinoReceiptFromTerminalResult({
      ...base,
      result: {
        ...bet,
        kind: "settled",
        stake: 200000n,
        settlement: {
          payoutNet: 196000n,
          refundAmount: 100000n,
          payment: { status: "transferred", amount: "196000" }
        }
      }
    });
    expect(model.payment).toEqual({ status: "unknown", amount: "296000" });
  });
  it("distinguishes a confirmed zero amount from missing transfer evidence", () => {
    const model = buildCasinoReceiptFromTerminalResult({
      ...base,
      result: {
        ...bet,
        kind: "settled",
        stake: 200000n,
        settlement: { payoutNet: 0n, refundAmount: 0n }
      }
    });
    expect(model.payment).toEqual({ status: "none", amount: "0" });
  });
});
