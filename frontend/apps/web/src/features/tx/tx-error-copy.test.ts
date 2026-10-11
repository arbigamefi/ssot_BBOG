import { describe, expect, it } from "vitest";

import en from "../../i18n/locales/en/common.json";
import {
  readErrorMessage,
  thrownErrorMessage,
  TxCopyError,
  txCopyDomainError,
  txErrorCopyKey,
  txErrorMessage
} from "./tx-error-copy";

function t(key: string, values?: Record<string, string | number>) {
  const message = key
    .split(".")
    .reduce<unknown>((value, part) => (value as Record<string, unknown> | undefined)?.[part], en);
  if (typeof message !== "string") return key;
  return Object.entries(values ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    message
  );
}

describe("transaction error copy", () => {
  it.each([
    ["USER_REJECTED", "canceled"],
    ["CHAIN_MISMATCH", "network"],
    ["DEPOSITS_PAUSED", "depositsPaused"],
    ["VOID_NOT_ELIGIBLE", "voidNotEligible"],
    ["VOID_GAS_TOO_LOW", "voidGasTooLow"],
    ["PLAYER_OPEN_HOLD_LIMIT", "playerLimit"],
    ["GAME_DISABLED", "gameClosed"],
    ["TX_STATUS_UNKNOWN", "unconfirmed"],
    ["REFUND_NOT_READY", "refundNotReady"],
    ["BAD_STATE", "betChanged"],
    ["BET_NOT_OPEN", "betChanged"],
    ["REVERT_InvalidRandomReceipt", "resultReceived"],
    ["REVERT_SomethingNew", "unknown"]
  ])("maps %s to localized copy, never the SDK message", (code, key) => {
    expect(txErrorCopyKey({ code })).toBe(key);
    const message = txErrorMessage(t, { code, message: "raw provider text 0xdeadbeef" });
    expect(message).not.toContain("raw provider text");
    expect(message).toBe(t(`app.txErrors.${key}`));
  });

  it("uses a page override for a code whose meaning depends on the call", () => {
    expect(
      txErrorMessage(
        t,
        { code: "INVALID_CONFIG" },
        { INVALID_CONFIG: "portfolio.referral.errors.rejected" }
      )
    ).toBe(en.portfolio.referral.errors.rejected);
    expect(txErrorMessage(t, undefined)).toBe(en.app.txErrors.unknown);
  });

  it("shows a page's own refusal by its copy key, whether thrown or recorded by a hook", () => {
    const refusal = new TxCopyError("app.txErrors.invalidAmount", { decimals: 6 });
    const expected =
      "Enter the amount as a number with a dot for decimals, for example 12.5, and at most 6 decimal places.";
    expect(thrownErrorMessage(t, refusal, "earn.toast.failed")).toBe(expected);
    expect(txErrorMessage(t, txCopyDomainError(refusal))).toBe(expected);
  });

  it("never shows thrown or read text", () => {
    expect(thrownErrorMessage(t, new Error("raw provider text"), "earn.toast.failed")).toBe(
      en.earn.toast.failed
    );
    expect(txErrorMessage(t, { code: "UNKNOWN_TX_ERROR", message: "raw provider text" })).toBe(
      en.app.txErrors.unknown
    );
    expect(readErrorMessage(t)).toBe(en.app.txErrors.readFailed);
  });

  it("has every key in the English messages", () => {
    for (const key of Object.keys(en.app.txErrors)) expect(t(`app.txErrors.${key}`)).not.toBe(key);
  });
});
