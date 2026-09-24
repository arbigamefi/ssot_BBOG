import { describe, expect, it } from "vitest";
import { getStepperErrorMessage, isBetSubmissionUnconfirmed } from "./feedback";
import zh from "../../../i18n/locales/zh-Hans/common.json";
const t = (key: string) => key.split(".").reduce((value: any, part) => value[part], zh) as string;
describe("game room feedback", () => {
  it.each([
    "RISK_IN_PAUSED",
    "USER_REJECTED",
    "ALLOWANCE_NOT_CONFIRMED",
    "INSUFFICIENT_BALANCE",
    "INSUFFICIENT_NATIVE_BALANCE",
    "INSUFFICIENT_LIQUIDITY",
    "CHAIN_MISMATCH",
    "RPC_ERROR",
    "TX_TIMEOUT",
    "TX_REVERTED"
  ])("localizes %s without leaking provider data", (code) => {
    const message = getStepperErrorMessage(
      { code, message: "secret RPC URL calldata" },
      "fallback",
      t
    );
    expect(message).not.toBe("fallback");
    expect(message).not.toContain("secret");
  });
  it("distinguishes rejection from an unconfirmed transaction", () => {
    expect(isBetSubmissionUnconfirmed({ code: "USER_REJECTED" })).toBe(false);
    expect(isBetSubmissionUnconfirmed({ code: "TX_TIMEOUT" })).toBe(true);
    expect(isBetSubmissionUnconfirmed({ code: "TX_STATUS_UNKNOWN" })).toBe(true);
    expect(getStepperErrorMessage({ code: "RISK_IN_PAUSED" }, undefined, t)).toContain("暂停");
  });
  it("uses a safe fallback without a translator or error", () => {
    expect(getStepperErrorMessage({ code: "USER_REJECTED", message: "raw" }, "fallback")).toBe(
      "fallback"
    );
    expect(getStepperErrorMessage(undefined)).toBe("—");
  });
});
