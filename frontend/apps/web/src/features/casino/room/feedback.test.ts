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

  it("falls back to a neutral placeholder when no localized fallback is provided", () => {
    expect(getStepperErrorMessage(undefined)).toBe("—");
  });

  it("accepts a localized fallback message", () => {
    expect(getStepperErrorMessage(undefined, "交易失败，请重试。")).toBe("交易失败，请重试。");
  });
});
