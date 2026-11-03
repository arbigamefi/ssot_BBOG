import { describe, expect, it } from "vitest";
import type { BetRow } from "@ssot/ssot/indexer";

import type { CasinoTerminalRoundResult } from "../casino/room/resolution";
import { exactAmount, receiptFromResult, receiptFromRow, shortId, splitAmount } from "./receipt";

const HUB = "0x00000000000000000000000000000000000000a6";
const TX = "0x7e24000000000000000000000000000000000000000000000000000000af90";

function row(overrides: Partial<BetRow>): BetRow {
  return {
    id: `84532:${HUB}:1`,
    chainId: 84532,
    gameHub: HUB,
    betId: "1",
    gameId: "0x01",
    state: "finalized",
    stake: "10000",
    payoutGross: "20000",
    payout: "19600",
    refundAmount: "0",
    placedBlock: 51_346_846,
    requestId: "86577843407123870663933366161905983352653535481161166303575843784462175295639",
    randomHash: "0x1f63000000000000000000000000000000000000000000000000000000001013",
    terminalTxHash: TX,
    lastTxHash: TX,
    lastEventName: "BetFinalized",
    updatedAt: 1,
    updatedBlock: 1,
    ...overrides
  } as BetRow;
}

const usdc = { chainId: 84532, decimals: 6 };

describe("receiptFromRow", () => {
  it("prints a win with every amount exact and the points lined up", () => {
    const receipt = receiptFromRow(row({}), usdc);
    expect(receipt?.stamp).toBe("paid");
    expect(receipt?.owed).toBe(false);
    expect(receipt?.net).toEqual({ sign: "+", whole: "0", fraction: "0096" });
    expect(receipt?.lines).toEqual([
      { key: "stake", amount: "0.0100" },
      { key: "won", amount: "0.0200" },
      { key: "houseEdge", amount: "0.0004" },
      { key: "paid", amount: "0.0196" }
    ]);
    // Bet ids restart in every GameHub, so the link names the hub.
    expect(receipt?.href).toBe(`/casino/receipt/84532/1?hub=${HUB}`);
    expect(receipt?.settledTxHref).toBe(`https://sepolia.basescan.org/tx/${TX}`);
  });

  it("prints a loss as settled, with the stake as the net result", () => {
    const receipt = receiptFromRow(row({ stake: "1500000", payoutGross: "0", payout: "0" }), usdc);
    expect(receipt?.stamp).toBe("settled");
    expect(receipt?.net).toEqual({ sign: "−", whole: "1", fraction: "50" });
    expect(receipt?.lines.map((line) => line.amount)).toEqual(["1.50", "0.00", "0.00", "0.00"]);
  });

  it("prints a multi-round bet with the unused stake that came back, counted in the net", () => {
    // Five rounds of 0.60; a stop-loss ended it after three, two of which won 0.55 each.
    const receipt = receiptFromRow(
      row({ stake: "3000000", payoutGross: "1122448", payout: "1100000", refundAmount: "1200000" }),
      usdc
    );
    expect(receipt?.stamp).toBe("paid");
    expect(receipt?.lines).toEqual([
      { key: "stake", amount: "3.000000" },
      { key: "won", amount: "1.122448" },
      { key: "houseEdge", amount: "0.022448" },
      { key: "paid", amount: "1.100000" },
      { key: "unused", amount: "1.200000" }
    ]);
    expect(receipt?.net).toEqual({ sign: "−", whole: "0", fraction: "700000" });
  });

  it("prints a payout the settlement held for the wallet as owed, stamped settled", () => {
    const owed = receiptFromRow(row({}), {
      ...usdc,
      payment: { status: "payable", amount: "19600" }
    });
    expect(owed?.owed).toBe(true);
    expect(owed?.stamp).toBe("settled");
    expect(owed?.lines[3]).toEqual({ key: "owed", amount: "0.0196" });
    // Evidence for another amount proves nothing about this bet.
    const other = receiptFromRow(row({}), { ...usdc, payment: { status: "payable", amount: "1" } });
    expect(other?.owed).toBe(false);
    expect(other?.stamp).toBe("paid");
  });

  it("prints a refund with the stake that came back to the wallet", () => {
    const receipt = receiptFromRow(
      row({
        state: "refunded",
        stake: "800000",
        payout: undefined,
        payoutGross: undefined,
        refundAmount: "800000",
        terminalTxHash: undefined,
        refundedTxHash: TX
      }),
      usdc
    );
    expect(receipt?.stamp).toBe("refunded");
    expect(receipt?.net).toEqual({ sign: "", whole: "0", fraction: "00" });
    expect(receipt?.lines).toEqual([
      { key: "stake", amount: "0.80" },
      { key: "returned", amount: "0.80" }
    ]);
    expect(receipt?.settledTx).toBe(TX);
  });

  it("prints a void with the stake as a claimable balance, never as a payout", () => {
    const receipt = receiptFromRow(
      row({
        state: "voided",
        stake: "250000000000000001",
        payout: undefined,
        payoutGross: undefined,
        refundAmount: "250000000000000001",
        voidedTxHash: TX
      }),
      { chainId: 84532, decimals: 18 }
    );
    expect(receipt?.stamp).toBe("voided");
    expect(receipt?.lines).toEqual([
      { key: "stake", amount: "0.250000000000000001" },
      { key: "claimable", amount: "0.250000000000000001" }
    ]);
  });

  it("prints nothing for a bet that has not finished or whose amounts are missing", () => {
    expect(receiptFromRow(row({ state: "placed" }), usdc)).toBeNull();
    expect(receiptFromRow(row({ state: "randomReady" }), usdc)).toBeNull();
    expect(receiptFromRow(row({ payoutGross: undefined }), usdc)).toBeNull();
    expect(receiptFromRow(row({ refundAmount: undefined }), usdc)).toBeNull();
    expect(receiptFromRow(row({ payout: "30000" }), usdc)).toBeNull();
  });
});

describe("receiptFromResult", () => {
  const proof = {
    betId: 5n,
    requestId: 1782n,
    randomHash: "0xf106000000000000000000000000000000000000000000000000000000e846" as const,
    player: "0x1111111111111111111111111111111111111111" as const,
    stake: 800_000n
  };
  const room = { chainId: 84532, decimals: 6, gameHub: HUB };

  it("prints a win exactly, stamped paid to wallet", () => {
    const result: CasinoTerminalRoundResult = {
      ...proof,
      kind: "settled",
      settlement: {
        txHash: "0x897a00000000000000000000000000000000000000000000000000000029cd",
        payoutGross: 842_105n,
        feeOnPayout: 16_842n,
        payoutNet: 825_263n,
        refundAmount: 0n
      }
    };
    const receipt = receiptFromResult(result, null, room);
    expect(receipt.stamp).toBe("paid");
    expect(receipt.net).toEqual({ sign: "+", whole: "0", fraction: "025263" });
    expect(receipt.lines).toEqual([
      { key: "stake", amount: "0.800000" },
      { key: "won", amount: "0.842105" },
      { key: "houseEdge", amount: "0.016842" },
      { key: "paid", amount: "0.825263" }
    ]);
    expect(receipt.href).toBe(`/casino/receipt/84532/5?hub=${HUB}`);
  });

  it("prints a loss as settled, and a payout held for the wallet as owed", () => {
    const loss = receiptFromResult(
      {
        ...proof,
        stake: 147_000n,
        kind: "settled",
        settlement: { payoutNet: 0n, refundAmount: 0n }
      },
      null,
      room
    );
    expect(loss.stamp).toBe("settled");
    expect(loss.net).toEqual({ sign: "−", whole: "0", fraction: "147" });

    const owed = receiptFromResult(
      {
        ...proof,
        kind: "settled",
        settlement: {
          payoutGross: 842_105n,
          feeOnPayout: 16_842n,
          payoutNet: 825_263n,
          refundAmount: 0n,
          payment: { status: "payable", amount: "825263" }
        }
      },
      null,
      room
    );
    expect(owed.owed).toBe(true);
    expect(owed.stamp).toBe("settled");
    expect(owed.lines.map((line) => line.key)).toContain("owed");
  });

  it("prints a refund and a voided bet with what came back", () => {
    const refund = { refundAmount: 800_000n, txHash: "0xabc" };
    const refunded = receiptFromResult({ ...proof, kind: "refunded", refund }, null, room);
    expect(refunded.stamp).toBe("refunded");
    expect(refunded.net).toEqual({ sign: "", whole: "0", fraction: "00" });
    expect(refunded.lines).toEqual([
      { key: "stake", amount: "0.80" },
      { key: "returned", amount: "0.80" }
    ]);
    const voided = receiptFromResult({ ...proof, kind: "voided", refund }, null, room);
    expect(voided.stamp).toBe("voided");
    expect(voided.lines[1]?.key).toBe("claimable");
  });
});

describe("amounts", () => {
  it("groups thousands without rounding the fraction", () => {
    expect(splitAmount(1_234_567_891n, 6, 6)).toEqual({
      sign: "+",
      whole: "1,234",
      fraction: "567891"
    });
    expect(splitAmount(-5n, 6, 2)).toEqual({ sign: "−", whole: "0", fraction: "00" });
  });

  it("prints a fee in wei exactly, with at least two decimals", () => {
    expect(exactAmount(12_345_678_901_234n, 18)).toBe("0.000012345678901234");
    expect(exactAmount(10n ** 18n, 18)).toBe("1.00");
  });

  it("keeps the ends of request ids and hashes", () => {
    expect(shortId("86577843407123875639")).toBe("8657…5639");
    expect(shortId("0x1f63aaaaaaaa1013")).toBe("0x1f63…1013");
    expect(shortId("0x1234")).toBe("0x1234");
  });
});
