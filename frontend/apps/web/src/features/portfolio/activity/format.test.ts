import { describe, expect, it } from "vitest";
import type { BetRow } from "@ssot/ssot/indexer";
import { formatOutcome, getBigIntField, isLossStatus, isOpenStatus, mapBetState } from "./format";

describe("activity cash and net outcome", () => {
  it.each([
    ["finalized", "196000", "100000", "won", "+0.096 USDC"],
    ["finalized", "0", "100000", "lost", "-0.1 USDC"],
    ["finalized", "196000", "0", "lost", "-0.004 USDC"],
    ["refunded", "200000", "200000", "refunded", "0.2 USDC"],
    ["finalized", "100000", "100000", "settled", "0 USDC"]
  ])(
    "classifies %s award %s refund %s by net cash",
    (state, award, refundAmount, expectedStatus, label) => {
      const row = { state, stake: "200000", payout: award, refundAmount } as BetRow;
      const payout = getBigIntField(row, "payout");
      const status = mapBetState(state, payout, 200000n);
      expect(status).toBe(expectedStatus);
      expect(formatOutcome({ status, payout, stake: 200000n, decimals: 6, symbol: "USDC" })).toBe(
        label
      );
    }
  );
  it("reads a timeout refund like a void: the returned stake, not a zero net or a loss", () => {
    const row = {
      state: "refunded",
      stake: "200000",
      payout: "0",
      refundAmount: "200000"
    } as BetRow;
    const payout = getBigIntField(row, "payout");
    const status = mapBetState("refunded", payout, 200000n);
    expect(status).toBe("refunded");
    expect(isOpenStatus(status)).toBe(false);
    expect(isLossStatus(status)).toBe(false);
    expect(
      formatOutcome({
        status,
        payout,
        stake: 200000n,
        decimals: 6,
        symbol: "USDC",
        returnedLabel: (amount) => `${amount} returned`
      })
    ).toBe("0.2 USDC returned");
  });

  it("shows a voided bet's returned stake instead of a zero net or a pending bet", () => {
    const row = { state: "voided", stake: "200000", payout: "0", refundAmount: "200000" } as BetRow;
    const payout = getBigIntField(row, "payout");
    const status = mapBetState("voided", payout, 200000n);
    expect(status).toBe("voided");
    expect(isOpenStatus(status)).toBe(false);
    expect(isLossStatus(status)).toBe(false);
    expect(
      formatOutcome({
        status,
        payout,
        stake: 200000n,
        decimals: 6,
        symbol: "USDC",
        returnedLabel: (amount) => `${amount} returned`
      })
    ).toBe("0.2 USDC returned");
  });
  it("does not label unknown refund, full refund or failed submissions as losses", () => {
    const payout = getBigIntField(
      { state: "finalized", stake: "200000", payout: "196000" } as BetRow,
      "payout"
    );
    expect(payout).toBeUndefined();
    expect(mapBetState("finalized", payout, 200000n)).toBe("settled");
    expect(
      formatOutcome({ status: "settled", payout, stake: 200000n, decimals: 6, symbol: "USDC" })
    ).toBe("—");
    expect(isLossStatus("refunded")).toBe(false);
    expect(isLossStatus("failed")).toBe(false);
  });
});
