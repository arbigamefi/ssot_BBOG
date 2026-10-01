import { describe, expect, it } from "vitest";

import {
  betAmountInputToRaw,
  clampBetAmountInput,
  getMinBetAmountInput,
  getMinBetAmountRaw,
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

  it("derives a valid minimum input for low-decimal assets", () => {
    expect(getMinBetAmountInput(0, getMinBetAmountRaw(1n, 100))).toBe("1");
    expect(getMinBetAmountInput(1, getMinBetAmountRaw(10n, 100))).toBe("0.1");
    expect(getMinBetAmountInput(6, getMinBetAmountRaw(1_000_000n, 100))).toBe("0.01");
  });

  it("uses total-stake minimum with ceiling rounding at every roll count", () => {
    expect(getMinBetAmountRaw(1_000_000n, 1)).toBe(1_000_000n);
    expect(getMinBetAmountRaw(1_000_000n, 3)).toBe(333_334n);
    expect(getMinBetAmountRaw(1_000_000n, 100)).toBe(10_000n);
    expect(getMinBetAmountRaw(0n, 1)).toBe(0n);
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
