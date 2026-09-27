import { describe, expect, it } from "vitest";
import type { BetRow } from "@ssot/ssot/indexer";

import {
  buildCasinoReceiptFromBetRow,
  buildCasinoReceiptFromTerminalResult,
  buildCasinoReceiptProofText
} from "./view-model";
import type { CasinoTerminalRoundResult } from "../room/resolution";

const TX = "0x00000000000000000000000000000000000000000000000000000000000000aa";
const RANDOM = "0x00000000000000000000000000000000000000000000000000000000000000bb";
const PLAYER = "0x00000000000000000000000000000000000000cc";
const ASSET = "0x00000000000000000000000000000000000000dd";
const GAME = "0x00000000000000000000000000000000000000000000000000000000000000ee";

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

  it("normalizes durable BetRow facts for the public receipt page", () => {
    const row: BetRow = {
      asset: ASSET,
      betId: "42",
      chainId: 84532,
      finalizedTxHash: TX,
      gameId: GAME,
      id: "84532:42",
      lastEventName: "BetFinalized",
      lastTxHash: TX,
      payout: "2500000",
      refundAmount: "0",
      payoutGross: "3000000",
      placedAt: 1_717_171_000_000,
      placedBlock: 123,
      player: PLAYER,
      pricingAffiliate: "0x0000000000000000000000000000000000000000",
      randomHash: RANDOM,
      requestId: "77",
      stake: "1000000",
      state: "finalized",
      terminalTxHash: TX,
      updatedAt: 1_717_171_717_000,
      updatedBlock: 456
    };

    const model = buildCasinoReceiptFromBetRow({
      assetDecimals: 6,
      assetSymbol: "USDC",
      chainId: 84532,
      gameLabel: "Plinko",
      gameSlug: "plinko",
      row
    });

    expect(model).toMatchObject({
      betId: "42",
      gameId: GAME,
      lastEventName: "BetFinalized",
      multiplierValue: "2.50x",
      netValue: "1.5 USDC",
      player: PLAYER,
      shareText: "Plinko bet #42: + 1.5 USDC",
      signedNetValue: "+ 1.5 USDC",
      terminalTxHash: TX,
      tone: "win"
    });
    expect(buildCasinoReceiptProofText({ lastTx: TX, model, status: "Settled" })).toContain(
      "ArbiGameFi casino receipt #42"
    );
  });
  it.each([
    ["196000", "100000", 296000n, 96000n, "win"],
    ["0", "100000", 100000n, -100000n, "loss"],
    ["196000", "0", 196000n, -4000n, "loss"]
  ] as const)(
    "agrees between terminal and indexed receipts for award %s refund %s",
    (payout, refundAmount, cash, net, tone) => {
      const common = {
        assetDecimals: 6,
        assetSymbol: "USDC",
        chainId: 84532,
        gameLabel: "Coin Toss"
      };
      const row = {
        id: "84532:42",
        betId: "42",
        chainId: 84532,
        state: "finalized",
        stake: "200000",
        payout,
        refundAmount
      } as BetRow;
      const indexed = buildCasinoReceiptFromBetRow({ ...common, row });
      const terminal = buildCasinoReceiptFromTerminalResult({
        ...common,
        result: {
          kind: "settled",
          betId: 42n,
          player: PLAYER,
          randomHash: RANDOM,
          requestId: 77n,
          stake: 200000n,
          resolvedAt: 1,
          settlement: { txHash: TX, payoutNet: BigInt(payout), refundAmount: BigInt(refundAmount) }
        }
      });
      expect(indexed).toMatchObject({ payout: cash, net, tone });
      expect(terminal).toMatchObject({
        payout: cash,
        net,
        tone,
        payoutValue: indexed.payoutValue,
        signedNetValue: indexed.signedNetValue
      });
    }
  );

  it("counts a full refund once and refuses missing refund proof", () => {
    const common = {
      assetDecimals: 6,
      assetSymbol: "USDC",
      chainId: 84532,
      gameLabel: "Coin Toss"
    };
    const row = {
      id: "84532:42",
      betId: "42",
      chainId: 84532,
      state: "refunded",
      stake: "200000",
      payout: "200000",
      refundAmount: "200000"
    } as BetRow;
    expect(buildCasinoReceiptFromBetRow({ ...common, row })).toMatchObject({
      payout: 200000n,
      net: 0n,
      tone: "neutral"
    });
    expect(() =>
      buildCasinoReceiptFromBetRow({
        ...common,
        row: { ...row, state: "finalized", refundAmount: undefined }
      })
    ).toThrow("not ready");
  });

  it("shows where a v1.6 bet's house edge went, keeping small 18-decimal shares visible", () => {
    const row: BetRow = {
      asset: ASSET,
      betId: "9",
      chainId: 84532,
      gameHub: "0x00000000000000000000000000000000000000a6",
      gameId: GAME,
      id: "84532:0x00000000000000000000000000000000000000a6:9",
      lastEventName: "BetFinalized",
      lastTxHash: TX,
      payout: "0",
      payoutGross: "0",
      refundAmount: "0",
      stake: "1000000000000000",
      state: "finalized",
      terminalTxHash: TX,
      updatedAt: 1,
      updatedBlock: 1,
      houseEdge: {
        usedTurnover: "1000000000000000",
        effectiveHouseEdgeBps: 200,
        edge: "20000000000000",
        operatorShare: "10000000000000",
        lpRetained: "10000000000000",
        protocolFee: "3000000000000",
        r0: "2000000000000",
        r1: "4000000000000",
        r2: "1000000000000",
        markup: "0"
      }
    };
    const model = buildCasinoReceiptFromBetRow({
      assetDecimals: 18,
      assetSymbol: "WETH",
      chainId: 84532,
      gameLabel: "Dice",
      row
    });
    expect(model.houseEdge).toEqual({
      edgeValue: "0.00002 WETH",
      rateLabel: "2.00%",
      turnoverValue: "0.001 WETH",
      lpRetainedValue: "0.00001 WETH",
      protocolFeeValue: "0.000003 WETH",
      playerRakebackValue: "0.000002 WETH",
      referrersValue: "0.000005 WETH",
      affiliateMarkupValue: undefined
    });
    const proof = buildCasinoReceiptProofText({ lastTx: TX, model, status: "Settled" });
    expect(proof).toContain("House edge: 0.00002 WETH (2.00% of 0.001 WETH)");
    expect(proof).toContain("Kept by LPs: 0.00001 WETH");
    expect(proof).not.toContain("Referrer markup");

    const { houseEdge: _none, ...v15Row } = row;
    expect(
      buildCasinoReceiptFromBetRow({
        assetDecimals: 18,
        assetSymbol: "WETH",
        chainId: 8453,
        gameLabel: "Dice",
        row: v15Row
      }).houseEdge
    ).toBeUndefined();
  });
});
