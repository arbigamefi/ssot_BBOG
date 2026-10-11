import * as React from "react";
import type { DomainError } from "@ssot/ssot";
import { toast } from "@ssot/ui";

export type StepperDisplayError = Partial<DomainError>;

export function getBetErrorKind(error?: StepperDisplayError) {
  switch (error?.code) {
    case "RISK_IN_PAUSED":
    case "ENFORCED_PAUSE":
      return "paused";
    case "POOL_INACTIVE":
      return "inactive";
    case "USER_REJECTED":
      return "canceled";
    case "ALLOWANCE_NOT_CONFIRMED":
      return "approvalPending";
    case "INSUFFICIENT_ALLOWANCE":
      return "allowance";
    case "INSUFFICIENT_BALANCE":
      return "balance";
    case "INSUFFICIENT_NATIVE_BALANCE":
      return "gas";
    case "INSUFFICIENT_VRF_FEE":
      return "quoteChanged";
    case "POOL_CAPACITY_FULL":
    case "OPEN_HOLD_LIMIT":
      return "capacity";
    case "PLAYER_OPEN_HOLD_LIMIT":
      return "playerLimit";
    case "GAME_DISABLED":
      return "gameClosed";
    case "STAKE_BELOW_MINIMUM":
      return "minimumStake";
    case "INSUFFICIENT_LIQUIDITY":
    case "SOLVENCY_VIOLATION":
      return "liquidity";
    case "CHAIN_MISMATCH":
      return "network";
    case "WALLET_NOT_CONNECTED":
    case "SDK_NOT_READY":
      return "wallet";
    case "RPC_ERROR":
      return "connection";
    case "TX_TIMEOUT":
    case "TX_STATUS_UNKNOWN":
      return "unconfirmed";
    case "TX_REVERTED":
      return "reverted";
    case "BET_CONTEXT_CHANGED":
      return "contextChanged";
    case "STAKE_SPEC_MISMATCH":
    case "BAD_INPUT":
      return "input";
    case "HOUSE_EDGE_TOO_HIGH":
      return "houseEdgeChanged";
    default:
      return error?.details?.transactionSubmitted === false ? "notSubmitted" : "unknown";
  }
}

/** Failures that say nothing about the contract: the wallet, the connection or the page context. */
const NOT_CONTRACT_REVERTS = new Set([
  "USER_REJECTED",
  "WALLET_NOT_CONNECTED",
  "SDK_NOT_READY",
  "CHAIN_MISMATCH",
  "WALLET_CONTEXT_CHANGED",
  "BET_CONTEXT_CHANGED",
  "INSUFFICIENT_NATIVE_BALANCE",
  "RPC_ERROR",
  "TX_TIMEOUT",
  "TX_STATUS_UNKNOWN",
  "UNKNOWN",
  "UNKNOWN_TX_ERROR"
]);

/**
 * The contract refused the transaction: a simulated revert (custom error or reason) or a mined revert.
 * The SDK names wallet, connection and context failures, and passes other viem failures on under
 * their PascalCase error name; none of those is a revert.
 */
export function isContractRevert(error?: StepperDisplayError) {
  const code = error?.code;
  if (!code || NOT_CONTRACT_REVERTS.has(code)) return false;
  return !/^[A-Z][A-Za-z]*Error$/.test(code);
}

export function isBetSubmissionUnconfirmed(error?: StepperDisplayError) {
  return getBetErrorKind(error) === "unconfirmed";
}

export function getStepperErrorMessage(
  error: StepperDisplayError | undefined,
  fallbackMessage = "—",
  translate?: (key: string) => string
) {
  if (!error) return fallbackMessage;
  // Never show raw provider text, calldata or RPC URLs to players.
  return translate?.(`casino.room.feedback.${getBetErrorKind(error)}`) ?? fallbackMessage;
}

export function useBetStepperFailureToast({
  status,
  error,
  fallbackMessage,
  translate
}: {
  status: string;
  error: DomainError | undefined;
  fallbackMessage?: string;
  translate?: (key: string) => string;
}) {
  const prevStatusRef = React.useRef<string>("");

  React.useEffect(() => {
    if (status === "failed" && prevStatusRef.current !== "failed") {
      const message = getStepperErrorMessage(error, fallbackMessage, translate);
      if (error?.severity === "info") toast.info(message);
      else if (error?.severity === "warning") toast.warning(message);
      else toast.error(message);
    }
    prevStatusRef.current = status;
  }, [status, error, fallbackMessage, translate]);
}

export function useVrfTimeoutToast(isSoftTimeout: boolean, message = "—") {
  const shownRef = React.useRef(false);

  React.useEffect(() => {
    if (!isSoftTimeout) {
      shownRef.current = false;
      return;
    }
    if (!shownRef.current) {
      shownRef.current = true;
      toast.warning(message, {
        duration: 20000,
        id: "vrf-timeout"
      });
    }
  }, [isSoftTimeout, message]);
}
