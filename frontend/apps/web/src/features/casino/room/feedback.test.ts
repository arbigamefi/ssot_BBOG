import { describe, expect, it } from "vitest";
import {
  getBetErrorKind,
  getStepperErrorMessage,
  isBetSubmissionUnconfirmed,
  isContractRevert
} from "./feedback";
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
    "POOL_CAPACITY_FULL",
    "OPEN_HOLD_LIMIT",
    "STAKE_BELOW_MINIMUM",
    "HOUSE_EDGE_TOO_HIGH",
    "CHAIN_MISMATCH",
    "RPC_ERROR",
    "TX_TIMEOUT",
    "TX_REVERTED",
    "PLAYER_OPEN_HOLD_LIMIT",
    "GAME_DISABLED"
  ])("localizes %s without leaking provider data", (code) => {
    const message = getStepperErrorMessage(
      { code, message: "secret RPC URL calldata" },
      "fallback",
      t
    );
    expect(message).not.toBe("fallback");
    expect(message).not.toContain("secret");
  });
  it("explains capacity and minimum stake failures before or during simulation", () => {
    expect(getStepperErrorMessage({ code: "POOL_CAPACITY_FULL" }, undefined, t)).toContain("满额");
    expect(getStepperErrorMessage({ code: "OPEN_HOLD_LIMIT" }, undefined, t)).toContain("满额");
    expect(getStepperErrorMessage({ code: "STAKE_BELOW_MINIMUM" }, undefined, t)).toContain("最低");
  });
  it("names the per-player open-bet cap and a closed game (ADR-0037 §5, §6)", () => {
    expect(getBetErrorKind({ code: "PLAYER_OPEN_HOLD_LIMIT" })).toBe("playerLimit");
    expect(getBetErrorKind({ code: "GAME_DISABLED" })).toBe("gameClosed");
    expect(getStepperErrorMessage({ code: "PLAYER_OPEN_HOLD_LIMIT" }, undefined, t)).not.toBe(
      getStepperErrorMessage({ code: "OPEN_HOLD_LIMIT" }, undefined, t)
    );
  });
  it("prompts a new fee review after a governance change", () => {
    expect(getStepperErrorMessage({ code: "HOUSE_EDGE_TOO_HIGH" }, undefined, t)).toContain("费率");
    expect(getStepperErrorMessage({ code: "HOUSE_EDGE_TOO_HIGH" }, undefined, t)).toContain("刷新");
  });
  it("distinguishes rejection from an unconfirmed transaction", () => {
    expect(isBetSubmissionUnconfirmed({ code: "USER_REJECTED" })).toBe(false);
    expect(isBetSubmissionUnconfirmed({ code: "TX_TIMEOUT" })).toBe(true);
    expect(isBetSubmissionUnconfirmed({ code: "TX_STATUS_UNKNOWN" })).toBe(true);
    expect(getStepperErrorMessage({ code: "RISK_IN_PAUSED" }, undefined, t)).toContain("暂停");
  });
  it("only promises no submission when the pipeline proves the wallet was never called", () => {
    expect(
      getStepperErrorMessage(
        { code: "UNKNOWN", details: { transactionSubmitted: false } },
        undefined,
        t
      )
    ).toContain("投注尚未发送");
    expect(getStepperErrorMessage({ code: "UNKNOWN" }, undefined, t)).not.toContain("投注尚未发送");
    expect(isBetSubmissionUnconfirmed({ code: "TX_STATUS_UNKNOWN" })).toBe(true);
  });
  it.each([
    ["TX_REVERTED", true],
    ["CONTRACT_REVERT", true],
    ["REVERT_SettlementFailed", true],
    ["SOLVENCY_VIOLATION", true],
    ["BAD_STATE", true],
    ["USER_REJECTED", false],
    ["RPC_ERROR", false],
    ["CHAIN_MISMATCH", false],
    ["WALLET_CONTEXT_CHANGED", false],
    ["TX_TIMEOUT", false],
    ["TX_STATUS_UNKNOWN", false],
    ["UNKNOWN", false],
    ["TransactionExecutionError", false]
  ])("tells a contract revert (%s → %s) from wallet and connection failures", (code, revert) => {
    expect(isContractRevert({ code })).toBe(revert);
  });

  it("uses a safe fallback without a translator or error", () => {
    expect(getStepperErrorMessage({ code: "USER_REJECTED", message: "raw" }, "fallback")).toBe(
      "fallback"
    );
    expect(getStepperErrorMessage(undefined)).toBe("—");
  });
});
