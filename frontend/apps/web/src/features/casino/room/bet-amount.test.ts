import { describe, expect, it } from "vitest";

import { betAmountInputToRaw, normalizeBetAmountInput } from "./bet-amount";

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
});
