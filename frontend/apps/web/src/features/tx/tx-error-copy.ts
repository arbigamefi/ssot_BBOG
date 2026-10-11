import type { DomainError } from "@ssot/ssot";

/**
 * Localized copy for a failed write or read outside the casino room (the room keeps
 * `casino.room.feedback`). The SDK's English `message` and any thrown provider text are never shown:
 * they are developer text and may carry provider details.
 */
export type TxErrorCopyKey =
  | "canceled"
  | "wallet"
  | "network"
  | "gas"
  | "connection"
  | "unconfirmed"
  | "reverted"
  | "contextChanged"
  | "depositsPaused"
  | "voidNotEligible"
  | "voidGasTooLow"
  | "playerLimit"
  | "gameClosed"
  | "refundNotReady"
  | "betChanged"
  | "resultReceived"
  | "unknown";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** DomainError code under which the transaction hooks keep a `TxCopyError`. */
export const TX_COPY_ERROR_CODE = "TX_COPY";

/**
 * A refusal the page raises itself around a transaction (a malformed amount, a closed pool), carrying
 * the key of its copy. It is the only thrown error whose copy is shown; anything else thrown is
 * unexpected and reads as generic copy.
 */
export class TxCopyError extends Error {
  readonly copyKey: string;
  readonly values: Readonly<Record<string, string | number>>;

  constructor(copyKey: string, values: Readonly<Record<string, string | number>> = {}) {
    super(copyKey);
    this.name = "TxCopyError";
    this.copyKey = copyKey;
    this.values = values;
  }
}

/** The DomainError a transaction hook records for a `TxCopyError`. */
export function txCopyDomainError(error: TxCopyError): DomainError {
  return {
    code: TX_COPY_ERROR_CODE,
    message: error.copyKey,
    severity: "error",
    details: { copyKey: error.copyKey, values: error.values }
  };
}

export function txErrorCopyKey(error?: Partial<DomainError>): TxErrorCopyKey {
  switch (error?.code) {
    case "USER_REJECTED":
      return "canceled";
    case "WALLET_NOT_CONNECTED":
    case "SDK_NOT_READY":
      return "wallet";
    case "CHAIN_MISMATCH":
      return "network";
    case "INSUFFICIENT_NATIVE_BALANCE":
      return "gas";
    case "RPC_ERROR":
      return "connection";
    case "TX_TIMEOUT":
    case "TX_STATUS_UNKNOWN":
      return "unconfirmed";
    case "TX_REVERTED":
      return "reverted";
    case "WALLET_CONTEXT_CHANGED":
    case "BET_CONTEXT_CHANGED":
      return "contextChanged";
    case "DEPOSITS_PAUSED":
      return "depositsPaused";
    case "VOID_NOT_ELIGIBLE":
      return "voidNotEligible";
    case "VOID_GAS_TOO_LOW":
      return "voidGasTooLow";
    case "PLAYER_OPEN_HOLD_LIMIT":
      return "playerLimit";
    case "GAME_DISABLED":
      return "gameClosed";
    case "REFUND_NOT_READY":
      return "refundNotReady";
    case "BAD_STATE":
    case "BET_NOT_OPEN":
      return "betChanged";
    // GameHub.refund on a bet whose VRF result was received (ADR-0037 §7): it settles or voids.
    case "REVERT_InvalidRandomReceipt":
      return "resultReceived";
    default:
      return "unknown";
  }
}

function copyOf(error: Partial<DomainError>) {
  const details = error.details as { copyKey?: unknown; values?: unknown } | undefined;
  if (typeof details?.copyKey !== "string") return undefined;
  const values =
    details.values && typeof details.values === "object"
      ? (details.values as Record<string, string | number>)
      : undefined;
  return { key: details.copyKey, values };
}

/**
 * `overrides` maps an error code to a page-specific key, for codes whose meaning depends on the call
 * (ReferralRegistry reports every refused binding as InvalidConfig, for example).
 */
export function txErrorMessage(
  t: Translate,
  error: Partial<DomainError> | undefined,
  overrides?: Readonly<Record<string, string>>
) {
  if (error?.code === TX_COPY_ERROR_CODE) {
    const copy = copyOf(error);
    if (copy) return t(copy.key, copy.values);
  }
  const override = error?.code ? overrides?.[error.code] : undefined;
  return t(override ?? `app.txErrors.${txErrorCopyKey(error)}`);
}

/** Copy for anything thrown around a transaction: a `TxCopyError`'s own copy, otherwise `fallbackKey`. */
export function thrownErrorMessage(t: Translate, error: unknown, fallbackKey: string) {
  return error instanceof TxCopyError ? t(error.copyKey, error.values) : t(fallbackKey);
}

/** A failed chain read: never the provider's text, and never a stand-in zero. */
export function readErrorMessage(t: Translate) {
  return t("app.txErrors.readFailed");
}
