import { describe, expect, it } from "vitest";
import type { BetRow } from "@ssot/ssot/indexer";

import { createCurrentRelease } from "../../test/current-release";
import type { BetReceiptResponse } from "../betting/recent-bets";
import { buildReceiptPageView } from "./receipt-page-model";

const release = createCurrentRelease(84532);
const HUB = release.contracts.gameHub;
const ASSET = release.assets[0]!.address;
const DICE = release.gamesMeta.find((game) => game.slug === "dice")!.gameId;
const TX = "0x00000000000000000000000000000000000000000000000000000000000000aa";

function row(overrides: Partial<BetRow> = {}): BetRow {
  return {
    id: `84532:${HUB}:5`,
    chainId: 84532,
    gameHub: HUB as BetRow["gameHub"],
    betId: "5",
    gameId: DICE as BetRow["gameId"],
    asset: ASSET as BetRow["asset"],
    player: "0x00000000000000000000000000000000000000cc",
    state: "finalized",
    stake: "800000",
    payoutGross: "842105",
    payout: "825263",
    refundAmount: "0",
    requestId: "1782",
    randomHash: "0xf106000000000000000000000000000000000000000000000000000000e846",
    terminalTxHash: TX,
    lastTxHash: TX,
    lastEventName: "BetFinalized",
    placedBlock: 456,
    updatedAt: 1_717_171_717_000,
    updatedBlock: 460,
    ...overrides
  } as BetRow;
}

function response(overrides: Partial<BetReceiptResponse> = {}): BetReceiptResponse {
  return {
    schemaVersion: 1,
    chainId: 84532,
    betId: "5",
    cached: false,
    generatedAt: 1_717_171_720_000,
    source: "postgres",
    row: row(),
    ...overrides
  };
}

const build = (value: BetReceiptResponse | null) =>
  buildReceiptPageView({ chainId: 84532, betId: "5", response: value, release });

describe("buildReceiptPageView", () => {
  it("prints a won bet with its game, asset, pool and exact amounts", () => {
    const view = build(response());
    expect(view.kind).toBe("printed");
    if (view.kind !== "printed") return;
    expect(view.bet).toEqual({
      chainId: 84532,
      betId: "5",
      gameHub: HUB,
      gameSlug: "dice",
      gameLabel: release.gamesMeta.find((game) => game.slug === "dice")!.label,
      symbol: "USDC",
      decimals: 6
    });
    expect(view.receipt.stamp).toBe("paid");
    expect(view.receipt.lines.map((line) => line.amount)).toEqual([
      "0.800000",
      "0.842105",
      "0.016842",
      "0.825263"
    ]);
    expect(view.houseEdgeBps).toBe(200);
    expect(view.poolId).toBe(1);
    expect(view.source).toBe("index");
    expect(view.payment).toBeUndefined();
  });

  it("prints a lost bet as settled", () => {
    const view = build(response({ row: row({ payoutGross: "0", payout: "0" }) }));
    expect(view.kind === "printed" && view.receipt.stamp).toBe("settled");
    expect(view.kind === "printed" && view.receipt.net).toEqual({
      sign: "−",
      whole: "0",
      fraction: "80"
    });
  });

  it("prints an owed payout only on evidence for this bet's amount", () => {
    const owed = build(response({ payment: { status: "payable", amount: "825263" } }));
    expect(owed.kind === "printed" && owed.receipt.owed).toBe(true);
    expect(owed.kind === "printed" && owed.payment).toBe("payable");
    const other = build(response({ payment: { status: "transferred", amount: "1" } }));
    expect(other.kind === "printed" && other.payment).toBeUndefined();
    const sent = build(response({ payment: { status: "transferred", amount: "825263" } }));
    expect(sent.kind === "printed" && sent.payment).toBe("transferred");
  });

  it("prints refunds and voids with what came back", () => {
    const refund = { payout: undefined, payoutGross: undefined, refundAmount: "800000" };
    const refunded = build(response({ row: row({ ...refund, state: "refunded" }) }));
    expect(refunded.kind === "printed" && refunded.receipt.stamp).toBe("refunded");
    const voided = build(response({ row: row({ ...refund, state: "voided" }) }));
    expect(voided.kind === "printed" && voided.receipt.lines[1]).toEqual({
      key: "claimable",
      amount: "0.80"
    });
  });

  it("keeps the turnover allocation exact and apart from the receipt's lines", () => {
    const view = build(
      response({
        row: row({
          houseEdge: {
            usedTurnover: "800000",
            houseEdgeBps: 200,
            edge: "16000",
            operatorShare: "8000",
            lpRetained: "8000",
            protocolFee: "5600",
            r0: "0",
            r1: "2000",
            r2: "400"
          }
        })
      })
    );
    expect(view.kind === "printed" && view.allocation).toEqual({
      rateBps: 200,
      turnover: "0.80",
      edge: "0.016",
      liquidity: "0.008",
      referrers: "0.0024",
      protocol: "0.0056"
    });
  });

  it("waits on a placed bet and on one whose amounts are not all indexed", () => {
    const pending = build(
      response({ row: row({ state: "randomReady", payout: undefined, refundDeadline: 10 }) })
    );
    expect(pending).toMatchObject({
      kind: "pending",
      state: "randomReady",
      stake: "0.80",
      requestId: "1782",
      refundDeadline: 10
    });
    expect(build(response({ row: row({ refundAmount: undefined }) }))).toMatchObject({
      kind: "indexing",
      state: "finalized"
    });
  });

  it("tells a missing bet from an index that could not be read", () => {
    expect(build(response({ row: null })).kind).toBe("missing");
    expect(build(response({ row: null, source: "rpc-window" })).kind).toBe("degraded");
    expect(build(null).kind).toBe("degraded");
  });
});
