import { describe, expect, it } from "vitest";

import type { CasinoTerminalRoundResult } from "../room/resolution";
import {
  buildSlipReceipt,
  deriveSlipQuote,
  diceLoseRange,
  diceMultiplier,
  dicePayout,
  diceWinRange,
  diceWins,
  formatQuote,
  quoteRaw,
  slipMaxStake,
  stakeText,
  type SlipQuoteInput
} from "./slip-model";

const USDC = 6;
const unit = (value: number) => BigInt(Math.round(value * 1_000_000));

const READY: SlipQuoteInput = {
  access: "testnet",
  hasAccount: true,
  wrongNetwork: false,
  status: "idle",
  canCheckTransaction: false,
  poolAvailability: "ready",
  perRound: unit(1),
  rounds: 1,
  minPerRound: unit(0.01),
  poolMaxPerRound: unit(4.05),
  balance: unit(12.4),
  decimals: USDC
};

describe("dice odds", () => {
  it("wins on the line or under it when low, and above it when high", () => {
    expect(diceWins("under", 50)).toBe(50);
    expect(diceWinRange("under", 50)).toEqual([1, 50]);
    expect(diceLoseRange("under", 50)).toEqual([51, 100]);
    expect(diceWins("over", 80)).toBe(20);
    expect(diceWinRange("over", 80)).toEqual([81, 100]);
    expect(diceLoseRange("over", 80)).toEqual([1, 80]);
  });

  it("pays as DiceModule and GameHub do: floor the gross, then floor the edge", () => {
    // Bet 5 on Base Sepolia: high over 5, 0.8 USDC.
    expect(dicePayout(800_000n, 95, 200)).toBe(825_263n);
    expect(dicePayout(1_000_000n, 50, 200)).toBe(1_960_000n);
    expect(dicePayout(1_000_000n, 0, 200)).toBe(0n);
  });

  it("quotes the multiplier cut to two decimals", () => {
    expect(diceMultiplier(50, 200)).toEqual({ sign: "", whole: "1", fraction: "96" });
    expect(diceMultiplier(3, 200)).toEqual({ sign: "", whole: "32", fraction: "66" });
  });
});

describe("quoted amounts", () => {
  it("cut to two decimals from one unit and four below it, never rounding up", () => {
    expect(quoteRaw(1_069_999n, USDC)).toBe(1_060_000n);
    expect(quoteRaw(30_499n, USDC)).toBe(30_400n);
    expect(formatQuote(1_069_999n, USDC)).toBe("1.06");
    expect(formatQuote(30_499n, USDC)).toBe("0.0304");
    expect(formatQuote(1_250_000_000n, USDC)).toBe("1,250.00");
  });

  it("writes a stake the field can read back", () => {
    expect(stakeText(1_250_000_000n, USDC)).toBe("1250.00");
    expect(stakeText(30_400n, USDC)).toBe("0.0304");
  });
});

describe("deriveSlipQuote", () => {
  it("places the bet when nothing is in the way", () => {
    expect(deriveSlipQuote(READY)).toEqual({ action: { kind: "place", approval: false } });
    expect(deriveSlipQuote({ ...READY, needsApproval: true }).action).toEqual({
      kind: "place",
      approval: true
    });
  });

  it("sends a preview to Telegram before anything else", () => {
    expect(deriveSlipQuote({ ...READY, access: "preview", hasAccount: false })).toEqual({
      action: { kind: "telegram" },
      notice: { kind: "preview" }
    });
  });

  it("connects, then switches network, before reading any amount", () => {
    expect(deriveSlipQuote({ ...READY, hasAccount: false, perRound: 0n }).action.kind).toBe(
      "connect"
    );
    expect(deriveSlipQuote({ ...READY, wrongNetwork: true, perRound: 0n })).toEqual({
      action: { kind: "switchNetwork" },
      notice: { kind: "network" }
    });
  });

  it("names the wallet step while signing", () => {
    expect(deriveSlipQuote({ ...READY, status: "planning" }).action).toEqual({
      kind: "signing",
      step: "prepare"
    });
    expect(deriveSlipQuote({ ...READY, status: "submitting" }).action).toEqual({
      kind: "signing",
      step: "one"
    });
    expect(
      deriveSlipQuote({ ...READY, status: "submitting", executionStage: "approve" }).action
    ).toEqual({ kind: "signing", step: "allow" });
    expect(
      deriveSlipQuote({
        ...READY,
        status: "submitting",
        executionStage: "placeBet",
        needsApproval: true
      }).action
    ).toEqual({ kind: "signing", step: "bet" });
  });

  it("waits for the pool, and offers to check again when it is not ready", () => {
    expect(deriveSlipQuote({ ...READY, poolAvailability: "loading" }).action.kind).toBe(
      "poolLoading"
    );
    expect(deriveSlipQuote({ ...READY, poolAvailability: "full" })).toEqual({
      action: { kind: "checkAgain" },
      notice: { kind: "pool", status: "full" }
    });
  });

  it("turns the main button into the fix for the stake", () => {
    expect(deriveSlipQuote({ ...READY, perRound: unit(0.001) })).toEqual({
      action: { kind: "setStake", to: unit(0.01), why: "min" },
      notice: { kind: "min", min: unit(0.01) }
    });
    expect(deriveSlipQuote({ ...READY, perRound: unit(5), poolMaxPerRound: 1_069_999n })).toEqual({
      action: { kind: "setStake", to: unit(1.06), why: "overMax" },
      notice: { kind: "overMax", max: unit(1.06) }
    });
    expect(deriveSlipQuote({ ...READY, perRound: unit(2), rounds: 3, balance: unit(4) })).toEqual({
      action: { kind: "setStake", to: unit(1.33), why: "balance" },
      notice: { kind: "balance", balance: unit(4) }
    });
  });

  it("blocks a stake the pool has no room for", () => {
    expect(deriveSlipQuote({ ...READY, poolMaxPerRound: 0n })).toEqual({
      action: { kind: "blocked", why: "noCapacity" },
      notice: { kind: "noCapacity" }
    });
  });

  it("points to a faucet on the testnet and blocks on a live chain", () => {
    const broke = { ...READY, balance: 1_000n };
    expect(deriveSlipQuote(broke).action).toEqual({ kind: "faucet", asset: "usdc" });
    expect(deriveSlipQuote({ ...broke, access: "live" }).action).toEqual({
      kind: "blocked",
      why: "balance"
    });
    expect(deriveSlipQuote({ ...READY, errorKind: "gas" })).toEqual({
      action: { kind: "faucet", asset: "eth" },
      notice: { kind: "error", error: "gas" }
    });
    expect(deriveSlipQuote({ ...READY, access: "live", errorKind: "gas" }).action.kind).toBe(
      "place"
    );
  });

  it("checks an unconfirmed bet instead of placing it again", () => {
    expect(
      deriveSlipQuote({ ...READY, errorKind: "unconfirmed", canCheckTransaction: true })
    ).toEqual({
      action: { kind: "checkTransaction" },
      notice: { kind: "error", error: "unconfirmed" }
    });
    expect(deriveSlipQuote({ ...READY, errorKind: "unconfirmed" }).action).toEqual({
      kind: "blocked",
      why: "unconfirmed"
    });
  });

  it("says why the last attempt failed and keeps the bet one press away", () => {
    expect(deriveSlipQuote({ ...READY, errorKind: "canceled" })).toEqual({
      action: { kind: "place", approval: false },
      notice: { kind: "error", error: "canceled" }
    });
  });
});

describe("slipMaxStake", () => {
  it("takes the lower of the pool's limit and the balance shared by the rounds", () => {
    const base = { minPerRound: unit(0.01), decimals: USDC };
    expect(
      slipMaxStake({ ...base, poolMaxPerRound: unit(4.05), balance: unit(12.4), rounds: 1 })
    ).toBe(unit(4.05));
    expect(
      slipMaxStake({ ...base, poolMaxPerRound: unit(4.05), balance: unit(12.4), rounds: 5 })
    ).toBe(unit(2.48));
    expect(slipMaxStake({ ...base, balance: 0n, rounds: 1 })).toBe(unit(0.01));
    expect(slipMaxStake({ ...base, rounds: 1 })).toBeUndefined();
  });
});

describe("buildSlipReceipt", () => {
  const proof = {
    betId: 5n,
    requestId: 1782n,
    randomHash: "0xf106000000000000000000000000000000000000000000000000000000e846" as const,
    player: "0x1111111111111111111111111111111111111111" as const,
    stake: 800_000n
  };

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
      } as never
    };
    const receipt = buildSlipReceipt(result, null, USDC);
    expect(receipt.stamp).toBe("paid");
    expect(receipt.net).toEqual({ sign: "+", whole: "0", fraction: "025263" });
    expect(receipt.lines).toEqual([
      { key: "stake", amount: "0.800000" },
      { key: "won", amount: "0.842105" },
      { key: "houseEdge", amount: "0.016842" },
      { key: "paid", amount: "0.825263" }
    ]);
  });

  it("prints a loss as settled, and a payout held for the wallet as owed", () => {
    const loss = buildSlipReceipt(
      {
        ...proof,
        stake: 147_000n,
        kind: "settled",
        settlement: { payoutNet: 0n, refundAmount: 0n } as never
      },
      null,
      USDC
    );
    expect(loss.stamp).toBe("settled");
    expect(loss.net).toEqual({ sign: "−", whole: "0", fraction: "147" });

    const owed = buildSlipReceipt(
      {
        ...proof,
        kind: "settled",
        settlement: {
          payoutGross: 842_105n,
          feeOnPayout: 16_842n,
          payoutNet: 825_263n,
          refundAmount: 0n,
          payment: { status: "payable" }
        } as never
      },
      null,
      USDC
    );
    expect(owed.owed).toBe(true);
    expect(owed.stamp).toBe("settled");
    expect(owed.lines.map((line) => line.key)).toContain("owed");
  });

  it("prints a refund and a voided bet with what came back", () => {
    const refund = { refundAmount: 800_000n, txHash: "0xabc" } as never;
    const refunded = buildSlipReceipt({ ...proof, kind: "refunded", refund }, null, USDC);
    expect(refunded.stamp).toBe("refunded");
    expect(refunded.net).toEqual({ sign: "", whole: "0", fraction: "00" });
    expect(refunded.lines).toEqual([
      { key: "stake", amount: "0.80" },
      { key: "returned", amount: "0.80" }
    ]);
    const voided = buildSlipReceipt({ ...proof, kind: "voided", refund }, null, USDC);
    expect(voided.stamp).toBe("voided");
    expect(voided.lines[1]?.key).toBe("claimable");
  });
});
