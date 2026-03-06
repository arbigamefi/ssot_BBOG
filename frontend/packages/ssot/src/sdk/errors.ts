import { BaseError } from "viem";
import type { DomainError } from "../domain";

export function toDomainError(err: unknown): DomainError {
  // viem errors are typically BaseError instances.
  if (err instanceof BaseError) {
    // User rejected in wallet
    if (err.name === "UserRejectedRequestError") {
      return {
        code: "USER_REJECTED",
        message: "User rejected the request in wallet.",
        severity: "info",
        retryable: true
      };
    }

    // Contract revert decoded by viem (when ABI is provided in simulate)
    // The actual type name in viem is `ContractFunctionRevertedError`.
    // We avoid importing it directly to keep dependency surface small.
    //
    // viem wraps reverts in a chain: ContractFunctionExecutionError → ContractFunctionRevertedError.
    // Walk the cause chain to find the actual revert.
    const anyErr = err as any;
    const revertErr = findRevert(err);
    if (revertErr) {
      const errorName: string | undefined = revertErr.data?.errorName;
      const errorArgs: unknown[] | undefined = revertErr.data?.args;
      if (errorName && errorName !== "Error") {
        // Custom error decoded from ABI (e.g. SolvencyViolation, BetNotFound)
        return mapRevert(errorName, errorArgs);
      }
      // String revert (e.g. "ERC20: transfer amount exceeds allowance")
      // Use the top-level shortMessage which includes the reason string.
      const reason = anyErr?.shortMessage ?? revertErr.shortMessage ?? revertErr.message;
      return {
        code: "CONTRACT_REVERT",
        message: reason,
        severity: "error",
      };
    }

    // RPC / transport / chain mismatch
    if (err.name === "HttpRequestError" || err.name === "RpcRequestError") {
      return {
        code: "RPC_ERROR",
        message: anyErr?.shortMessage ?? err.message,
        severity: "error",
        retryable: true
      };
    }

    return {
      code: err.name || "UNKNOWN",
      message: anyErr?.shortMessage ?? err.message,
      severity: "error",
      retryable: true
    };
  }

  // Fallback
  const msg = err instanceof Error ? err.message : String(err);
  return { code: "UNKNOWN", message: msg, severity: "error", retryable: true };
}

/**
 * Walk the `.cause` chain to find a ContractFunctionRevertedError.
 * viem nests: ContractFunctionExecutionError → ContractFunctionRevertedError.
 */
function findRevert(err: unknown): any | undefined {
  let current: any = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (current.name === "ContractFunctionRevertedError") return current;
    current = current.cause;
  }
  return undefined;
}

function mapRevert(errorName: string, args?: unknown[]): DomainError {
  // Hub errors (subset)
  switch (errorName) {
    case "RiskInPaused":
      return {
        code: "RISK_IN_PAUSED",
        message: "New bets are currently paused for this asset.",
        severity: "warning",
        details: { asset: args?.[0] }
      };
    case "UnknownAsset":
      return {
        code: "UNKNOWN_ASSET",
        message: "This asset is not supported by the current Hub release.",
        severity: "error",
        details: { asset: args?.[0] }
      };
    case "UnknownGame":
      return {
        code: "UNKNOWN_GAME",
        message: "This gameId is not registered in the current Hub release.",
        severity: "error",
        details: { gameId: args?.[0] }
      };
    case "InsufficientVRFFee":
      return {
        code: "INSUFFICIENT_VRF_FEE",
        message: "Insufficient native token for VRF fee.",
        severity: "error",
        details: { paid: args?.[0], required: args?.[1] }
      };
    case "HouseEdgeTooHigh":
      return {
        code: "HOUSE_EDGE_TOO_HIGH",
        message: "The max house edge tolerance is too high.",
        severity: "error",
        details: { got: args?.[0], maxAllowed: args?.[1] }
      };
    case "HouseEdgeTooLow":
      return {
        code: "HOUSE_EDGE_TOO_LOW",
        message: "The max house edge tolerance is too low.",
        severity: "error",
        details: { got: args?.[0], minAllowed: args?.[1] }
      };
    case "RefundNotReady":
      return {
        code: "REFUND_NOT_READY",
        message: "Refund is not ready yet (timeout not reached).",
        severity: "warning",
        retryable: true,
        details: { betId: args?.[0], nowTs: args?.[1], readyAt: args?.[2] }
      };
    case "BadState":
      return {
        code: "BAD_STATE",
        message: "Bet is not in the expected state for this action.",
        severity: "error",
        details: { betId: args?.[0], got: args?.[1], want: args?.[2] }
      };
    case "BetNotFound":
      return {
        code: "BET_NOT_FOUND",
        message: "Bet does not exist.",
        severity: "error",
        details: { betId: args?.[0] }
      };
    case "NotVRFHub":
      return {
        code: "NOT_VRF_HUB",
        message: "Only the VRF Hub contract can call this function.",
        severity: "error"
      };
    case "InsufficientBalance":
      return {
        code: "INSUFFICIENT_BALANCE",
        message: "Insufficient token balance for this operation.",
        severity: "error"
      };
    case "InvalidBps":
      return {
        code: "INVALID_BPS",
        message: "Basis points value is out of range (must be 0–10000).",
        severity: "error",
        details: { bps: args?.[0] }
      };
    case "InvalidConfig":
      return {
        code: "INVALID_CONFIG",
        message: "Configuration parameters are invalid.",
        severity: "error"
      };
    case "ZeroAddress":
      return {
        code: "ZERO_ADDRESS",
        message: "Address must not be the zero address.",
        severity: "error"
      };
    // Bank errors
    case "SolvencyViolation":
      return {
        code: "SOLVENCY_VIOLATION",
        message: "Operation would violate bank solvency constraints.",
        severity: "error"
      };
    case "OptionalOutflowDomainViolation":
      return {
        code: "OPTIONAL_OUTFLOW_DOMAIN_VIOLATION",
        message: "Optional outflow blocked: insufficient free liquidity after minLiq + reserves.",
        severity: "warning"
      };
    case "NotHub":
      return {
        code: "NOT_HUB",
        message: "Only the Hub contract can call this function.",
        severity: "error"
      };
    case "BetAlreadyExists":
      return {
        code: "BET_ALREADY_EXISTS",
        message: "A bet with this ID already exists in the bank.",
        severity: "error",
        details: { betId: args?.[0] }
      };
    case "BetNotOpen":
      return {
        code: "BET_NOT_OPEN",
        message: "This bet is not in an open state.",
        severity: "error",
        details: { betId: args?.[0] }
      };
    case "ReservedTooSmall":
      return {
        code: "RESERVED_TOO_SMALL",
        message: "Reserved amount is too small to cover the required payout.",
        severity: "error",
        details: { betId: args?.[0], reserved: args?.[1], need: args?.[2] }
      };
    case "RefundTooLarge":
      return {
        code: "REFUND_TOO_LARGE",
        message: "Refund amount exceeds the original stake.",
        severity: "error",
        details: { betId: args?.[0], refundAmount: args?.[1], stake: args?.[2] }
      };
    case "XPInvalidAward":
      return {
        code: "XP_INVALID_AWARD",
        message: "XP award is invalid (zero payee or zero amounts).",
        severity: "error",
        details: { payee: args?.[0] }
      };
    case "XPTooManyAwards":
      return {
        code: "XP_TOO_MANY_AWARDS",
        message: "Too many XP awards in a single settlement.",
        severity: "error",
        details: { n: args?.[0] }
      };
    case "EnforcedPause":
      return {
        code: "ENFORCED_PAUSE",
        message: "Contract is paused. This operation is temporarily unavailable.",
        severity: "warning"
      };
    case "InsufficientAllowance":
      return {
        code: "INSUFFICIENT_ALLOWANCE",
        message: "Token allowance is insufficient. Please approve more tokens.",
        severity: "error",
        retryable: true
      };
    case "ReentrancyGuardReentrantCall":
      return {
        code: "REENTRANCY",
        message: "Reentrancy detected — please retry.",
        severity: "error",
        retryable: true
      };
    case "SafeERC20FailedOperation":
      return {
        code: "SAFE_ERC20_FAILED",
        message: "ERC20 token transfer failed.",
        severity: "error",
        details: { token: args?.[0] }
      };
    default:
      return {
        code: `REVERT_${errorName}`,
        message: `Contract reverted: ${errorName}`,
        severity: "error",
        details: { args }
      };
  }
}
