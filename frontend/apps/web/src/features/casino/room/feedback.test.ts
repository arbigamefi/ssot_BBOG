import { describe, expect, it } from "vitest";

import { getStepperErrorMessage } from "./feedback";

describe("game room feedback helpers", () => {
  it("uses localized fallback copy instead of raw domain error text", () => {
    expect(
      getStepperErrorMessage(
        {
          code: "TX_FAILED",
          message: 'The contract function "placeBet" reverted.',
          severity: "error"
        },
        "交易失败，请重试。"
      )
    ).toBe("交易失败，请重试。");
  });

  it("keeps wallet rejection copy when the SDK classified it as user-facing", () => {
    expect(
      getStepperErrorMessage(
        {
          code: "USER_REJECTED",
          message: "User rejected transaction.",
          severity: "warning"
        },
        "交易失败，请重试。"
      )
    ).toBe("User rejected transaction.");
  });

  it("falls back to a neutral placeholder when no localized fallback is provided", () => {
    expect(getStepperErrorMessage(undefined)).toBe("—");
  });

  it("accepts a localized fallback message", () => {
    expect(getStepperErrorMessage(undefined, "交易失败，请重试。")).toBe("交易失败，请重试。");
  });
});
