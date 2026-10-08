import { describe, expect, it } from "vitest";

import {
  betAmountInputToRaw,
  clampBetAmountInput,
  getMinBetAmountInput,
  multiplyBetAmountInput,
  normalizeBetAmountInput,
  resolveBetMaxRaw
} from "./bet-amount";

describe("bet amount helpers", () => {
  it("parses selected-asset decimals without going through floating point", () => {
    expect(betAmountInputToRaw("0.000000000000000001", 18)).toBe(1n);
    expect(betAmountInputToRaw("123456789.123456", 6)).toBe(123_456_789_123_456n);
  });

  it("does not cap normalized precision at 18 decimals", () => {
    expect(normalizeBetAmountInput("0.123456789012345678901234", 24)).toBe(
      "0.123456789012345678901234"
    );
  });

  it("formats the chain minimum per round at the selected asset precision", () => {
    expect(getMinBetAmountInput(0, 1n)).toBe("1");
    expect(getMinBetAmountInput(1, 1n)).toBe("0.1");
    expect(getMinBetAmountInput(6, 10_000n)).toBe("0.01");
  });

  it.each([1, 25])("keeps the 0.01 USDC per-round minimum for %i rounds", (count) => {
    const amount = clampBetAmountInput("0.009999", 6, 100_000_000n, 10_000n);
    expect(amount).toBe("0.01");
    expect(multiplyBetAmountInput(amount, count, 6)).toBe(count === 1 ? "0.01" : "0.25");
  });

  it("preserves entered stake while the pool minimum is unavailable", () => {
    expect(clampBetAmountInput("0.12", 6, 100_000_000n, 0n)).toBe("0.12");
    expect(clampBetAmountInput("0.12", 6, undefined, 0n)).toBe("0.12");
  });

  it("clamps the amount to the lower of wallet balance and pool cap", () => {
    const maxRaw = resolveBetMaxRaw(25_000_000n, 10_000_000n);

    expect(maxRaw).toBe(10_000_000n);
    expect(clampBetAmountInput("999", 6, maxRaw, 1_000_000n)).toBe("10");
  });
});
