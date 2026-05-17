import { describe, expect, it } from "vitest";

import { getStepperErrorMessage } from "./feedback";

describe("game room feedback helpers", () => {
  it("uses the domain error message when available", () => {
    expect(
      getStepperErrorMessage({
        code: "TX_FAILED",
        message: "User rejected transaction.",
        severity: "warning"
      })
    ).toBe("User rejected transaction.");
  });

  it("falls back to the generic transaction failure message", () => {
    expect(getStepperErrorMessage(undefined)).toBe("Transaction failed. Please try again.");
  });

  it("accepts a localized fallback message", () => {
    expect(getStepperErrorMessage(undefined, "交易失败，请重试。")).toBe("交易失败，请重试。");
  });
});
