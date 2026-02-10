import { describe, it, expect } from "vitest";

/**
 * Tests for bet outcome logic extracted from bet detail page.
 * Verifies win/loss/refund/pending classification and profit calculation.
 */

type Outcome =
  | { kind: "win"; profit: bigint }
  | { kind: "loss"; loss: bigint }
  | { kind: "refunded" }
  | { kind: "pending"; label: string };

function computeOutcome(
  betState: string | null,
  onChainBet: { stake: bigint; payout?: bigint } | null,
): Outcome | null {
  if (!onChainBet) return betState ? { kind: "pending", label: betState } : null;
  if (betState === "refunded") return { kind: "refunded" };
  if (betState === "finalized" && onChainBet.payout != null) {
    const profit = onChainBet.payout - onChainBet.stake;
    return profit >= 0n
      ? { kind: "win", profit }
      : { kind: "loss", loss: onChainBet.stake - onChainBet.payout };
  }
  return { kind: "pending", label: betState ?? "unknown" };
}

describe("Bet outcome computation", () => {
  it("returns null when no state and no on-chain bet", () => {
    expect(computeOutcome(null, null)).toBeNull();
  });

  it("returns pending when state exists but no on-chain data", () => {
    const result = computeOutcome("placed", null);
    expect(result).toEqual({ kind: "pending", label: "placed" });
  });

  it("returns pending for placed state with on-chain data", () => {
    const result = computeOutcome("placed", { stake: 1000n });
    expect(result).toEqual({ kind: "pending", label: "placed" });
  });

  it("returns pending for randomReady state", () => {
    const result = computeOutcome("randomReady", { stake: 1000n });
    expect(result).toEqual({ kind: "pending", label: "randomReady" });
  });

  it("returns refunded for refunded state", () => {
    const result = computeOutcome("refunded", { stake: 1000n });
    expect(result).toEqual({ kind: "refunded" });
  });

  it("returns win when payout > stake", () => {
    const result = computeOutcome("finalized", { stake: 1000n, payout: 2000n });
    expect(result).toEqual({ kind: "win", profit: 1000n });
  });

  it("returns win with zero profit when payout == stake", () => {
    const result = computeOutcome("finalized", { stake: 1000n, payout: 1000n });
    expect(result).toEqual({ kind: "win", profit: 0n });
  });

  it("returns loss when payout < stake", () => {
    const result = computeOutcome("finalized", { stake: 1000n, payout: 0n });
    expect(result).toEqual({ kind: "loss", loss: 1000n });
  });

  it("returns loss with partial payout", () => {
    const result = computeOutcome("finalized", { stake: 1000n, payout: 500n });
    expect(result).toEqual({ kind: "loss", loss: 500n });
  });

  it("returns pending when finalized but payout is undefined", () => {
    const result = computeOutcome("finalized", { stake: 1000n });
    expect(result).toEqual({ kind: "pending", label: "finalized" });
  });

  it("handles large bigint values", () => {
    const stake = 1000000000000000000n; // 1e18
    const payout = 2500000000000000000n; // 2.5e18
    const result = computeOutcome("finalized", { stake, payout });
    expect(result).toEqual({ kind: "win", profit: 1500000000000000000n });
  });
});
