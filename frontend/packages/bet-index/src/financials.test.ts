import { describe, expect, it } from "vitest";
import { getCasinoFinancials } from "./financials.js";

describe("casino cash and executed-stake accounting", () => {
  it.each([
    ["finalized", "196000", "100000", 296000n, 96000n, 100000n],
    ["finalized", "0", "100000", 100000n, -100000n, 100000n],
    ["finalized", "196000", "0", 196000n, -4000n, 200000n],
    ["refunded", "200000", "200000", 200000n, 0n, 0n]
  ])("reconciles %s award %s refund %s", (state, payout, refundAmount, returned, net, turnover) => {
    expect(getCasinoFinancials({ state, stake: "200000", payout, refundAmount })).toMatchObject({
      returned,
      net,
      turnover
    });
  });
  it.each([undefined, "", "-1", "200001", "invalid"])(
    "does not invent financials for refund %s",
    (refundAmount) => {
      expect(
        getCasinoFinancials({ state: "finalized", stake: "200000", payout: "196000", refundAmount })
      ).toBeUndefined();
    }
  );
});
