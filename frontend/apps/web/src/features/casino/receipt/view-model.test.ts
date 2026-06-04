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
});
