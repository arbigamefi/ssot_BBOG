import * as React from "react";
import type { DomainError } from "@ssot/ssot";
import { toast } from "@ssot/ui";

export type StepperDisplayError = Partial<DomainError>;

export function getBetErrorKind(error?: StepperDisplayError) {
  switch (error?.code) {
    case "RISK_IN_PAUSED":
    case "ENFORCED_PAUSE":
    case "POOL_INACTIVE":
      return "paused";
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
    case "BAD_INPUT":
    case "HOUSE_EDGE_TOO_LOW":
    case "HOUSE_EDGE_TOO_HIGH":
      return "input";
    default:
      return "unknown";
  }
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
