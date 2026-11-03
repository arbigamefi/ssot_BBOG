import { describe, expect, it } from "vitest";
import type { BetRow } from "@ssot/ssot/indexer";

import { buildHomeReceipt, shortId, splitAmount } from "./receipts";

function row(overrides: Partial<BetRow>): BetRow {
  return {
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
    terminalTxHash: "0x7e24000000000000000000000000000000000000000000000000000000af90",
    ...overrides
  } as BetRow;
}

describe("buildHomeReceipt", () => {
  it("prints a win with every amount exact and the points lined up", () => {
    const receipt = buildHomeReceipt(row({}), { chainId: 84532, decimals: 6 });
    expect(receipt?.stamp).toBe("paid");
    expect(receipt?.net).toEqual({ sign: "+", whole: "0", fraction: "0096" });
    expect(receipt?.lines).toEqual([
      { key: "stake", amount: "0.0100" },
      { key: "won", amount: "0.0200" },
      { key: "houseEdge", amount: "0.0004" },
      { key: "paid", amount: "0.0196" }
    ]);
    expect(receipt?.href).toBe("/casino/receipt/84532/1");
    expect(receipt?.settledTxHref).toBe(
      "https://sepolia.basescan.org/tx/0x7e24000000000000000000000000000000000000000000000000000000af90"
    );
  });

  it("prints a loss as settled, with the stake as the net result", () => {
    const receipt = buildHomeReceipt(row({ stake: "1500000", payoutGross: "0", payout: "0" }), {
      chainId: 84532,
      decimals: 6
    });
    expect(receipt?.stamp).toBe("settled");
    expect(receipt?.net).toEqual({ sign: "−", whole: "1", fraction: "50" });
    expect(receipt?.lines.map((line) => line.amount)).toEqual(["1.50", "0.00", "0.00", "0.00"]);
  });

  it("adds the unused stake that came back and counts it in the net result", () => {
    const receipt = buildHomeReceipt(
      row({ stake: "3000000", payoutGross: "2000000", payout: "1960000", refundAmount: "1000000" }),
      { chainId: 84532, decimals: 6 }
    );
    expect(receipt?.lines.at(-1)).toEqual({ key: "unused", amount: "1.00" });
    expect(receipt?.net).toEqual({ sign: "−", whole: "0", fraction: "04" });
  });

  it("prints nothing for a bet that has not settled or whose payout split is missing", () => {
    expect(buildHomeReceipt(row({ state: "placed" }), { chainId: 1, decimals: 6 })).toBeNull();
    expect(buildHomeReceipt(row({ state: "refunded" }), { chainId: 1, decimals: 6 })).toBeNull();
    expect(
      buildHomeReceipt(row({ payoutGross: undefined }), { chainId: 1, decimals: 6 })
    ).toBeNull();
    expect(buildHomeReceipt(row({ payout: "30000" }), { chainId: 1, decimals: 6 })).toBeNull();
  });

  it("groups thousands without rounding the fraction", () => {
    expect(splitAmount(1_234_567_891n, 6, 6)).toEqual({
      sign: "+",
      whole: "1,234",
      fraction: "567891"
    });
    expect(splitAmount(-5n, 6, 2)).toEqual({ sign: "−", whole: "0", fraction: "00" });
  });
});

describe("shortId", () => {
  it("keeps the ends of request ids and hashes", () => {
    expect(shortId("86577843407123875639")).toBe("8657…5639");
    expect(shortId("0x1f63aaaaaaaa1013")).toBe("0x1f63…1013");
    expect(shortId("0x1234")).toBe("0x1234");
  });
});
