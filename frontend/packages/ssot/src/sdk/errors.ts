import { BaseError } from "viem";
import type { DomainError } from "../domain";

export function toDomainError(err: unknown): DomainError {
  // Wallet and transport errors are often wrapped by ContractFunctionExecutionError.
  const causes: Array<{ name?: string; code?: number }> = [];
  let current: unknown = err;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    causes.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  if (causes.some((cause) => cause.name === "UserRejectedRequestError" || cause.code === 4001)) {
    return {
      code: "USER_REJECTED",
      message: "Wallet request canceled.",
      severity: "info",
      retryable: true
    };
  }
  if (causes.some((cause) => cause.name === "WalletContextChangedError")) {
    return {
      code: "WALLET_CONTEXT_CHANGED",
      message: "The wallet or network changed. Review the current action before trying again.",
      severity: "warning",
      retryable: false
    };
  }
  if (causes.some((cause) => cause.name === "BetContextChangedError")) {
    return {
      code: "BET_CONTEXT_CHANGED",
      message: "The wallet, network or bet settings changed. Review the current settings.",
      severity: "warning"
    };
  }
  if (causes.some((cause) => cause.name === "InsufficientFundsError")) {
    return {
      code: "INSUFFICIENT_NATIVE_BALANCE",
      message: "Insufficient native token for the transaction and gas.",
      severity: "warning"
    };
  }
  if (
    causes.some(
      (cause) =>
        ["ChainMismatchError", "SwitchChainError", "ChainNotConfiguredError"].includes(
          cause.name ?? ""
        ) || cause.code === 4902
    )
  ) {
    return {
      code: "CHAIN_MISMATCH",
      message: "Select the network used by this page in your wallet.",
      severity: "warning"
    };
  }
  if (
    causes.some(
      (cause) =>
        ["HttpRequestError", "WebSocketRequestError", "TimeoutError"].includes(cause.name ?? "") ||
        cause.code === 4900 ||
        cause.code === 4901
    )
  ) {
    return {
      code: "RPC_ERROR",
      message: (err as { shortMessage?: string })?.shortMessage ?? "Unable to reach the network.",
      severity: "warning",
      retryable: true
    };
  }
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
      // Match only decoded revert reasons, never arbitrary provider message text.
      const decodedReason = errorName === "Error" ? errorArgs?.[0] : revertErr.reason;
      if (
        ["ERC20: transfer amount exceeds allowance", "ERC20: insufficient allowance"].includes(
          decodedReason as string
        )
      ) {
        return mapRevert("ERC20InsufficientAllowance");
      }
      if (decodedReason === "ERC20: transfer amount exceeds balance") {
        return mapRevert("ERC20InsufficientBalance");
      }
      // String revert (e.g. "ERC20: transfer amount exceeds allowance")
      // Use the top-level shortMessage which includes the reason string.
      const reason = anyErr?.shortMessage ?? revertErr.shortMessage ?? revertErr.message;
      return {
        code: "CONTRACT_REVERT",
        message: reason,
        severity: "error"
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
    case "LPUnavailable":
      return {
        code: "LP_UNAVAILABLE",
        message: "LP operation is unavailable. Refresh the deposit status.",
        severity: "warning",
        details: { status: Number(args?.[0]) }
      };
    case "NotDepositOwner":
      return {
        code: "NOT_DEPOSIT_OWNER",
        message: "Only the current NFT owner may withdraw.",
        severity: "warning"
      };
    case "InsufficientFreeCapital":
      return {
        code: "INSUFFICIENT_FREE_CAPITAL",
        message: "Free LP capital changed. Refresh the percentage quote.",
        severity: "warning",
        retryable: true
      };
    case "IncorrectPercent":
    case "ZeroWithdrawal":
      return {
        code: "INVALID_NFT_WITHDRAWAL",
        message:
          "Choose a valid percentage with a nonzero payment, or close a matured zero-value NFT in full.",
        severity: "warning"
      };
    case "CapitalLimit":
      return {
        code: "CAPITAL_LIMIT",
        message: "The deposit exceeds the pool's admitted capital bound.",
        severity: "warning"
      };
    case "DepositsPaused":
      return {
        code: "DEPOSITS_PAUSED",
        message: "LP deposits are paused for this pool. Withdrawals stay open.",
        severity: "warning"
      };
    case "RiskInPaused":
      // GameHub reports the pool (paused Bank or inactive pool); the Bank's own error has no argument.
      // A pause closes only new bets and LP deposits (ADR-0037 §4).
      return {
        code: "RISK_IN_PAUSED",
        message: "New bets are closed for this pool: it is paused or inactive.",
        severity: "warning",
        details: { poolId: args?.[0] }
      };
    case "GameIsDisabled":
      return {
        code: "GAME_DISABLED",
        message: "This game is disabled for good and accepts no new bets or quotes.",
        severity: "warning",
        details: { gameId: args?.[0] }
      };
    case "VoidNotEligible":
      return {
        code: "VOID_NOT_ELIGIBLE",
        message: "This bet cannot be voided yet.",
        severity: "warning",
        retryable: true,
        details: { betId: args?.[0], nowTs: args?.[1], eligibleAt: args?.[2] }
      };
    case "VoidGasTooLow":
      return {
        code: "VOID_GAS_TOO_LOW",
        message: "The transaction gas limit is below the void's settlement-attempt floor.",
        severity: "error",
        details: { gasLeft: args?.[0], required: args?.[1] }
      };
    case "NoUnbookedResult":
      return {
        code: "NO_UNBOOKED_RESULT",
        message: "This pool's Bank has no unbooked result, so no void window can be opened.",
        severity: "warning",
        details: { bank: args?.[0] }
      };
    case "ForeignGovernance":
      return {
        code: "FOREIGN_GOVERNANCE",
        message:
          "The target has a different or pending governance than the registry and cannot be admitted.",
        severity: "error",
        details: { target: args?.[0] }
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
        message: "The current house edge exceeds the accepted fee ceiling. Refresh the quote.",
        severity: "error",
        details: { got: args?.[0], maxAllowed: args?.[1] }
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
    case "ERC20InsufficientBalance":
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
    case "BetAmountBelowMinimum":
      return {
        code: "STAKE_BELOW_MINIMUM",
        message: "The bet amount is below this pool’s per-round minimum.",
        severity: "warning",
        details: { amount: args?.[0], minimum: args?.[1] }
      };
    case "OpenHoldLimit":
      return {
        code: "OPEN_HOLD_LIMIT",
        message: "This pool is at its open-bet capacity. Try again after a bet settles.",
        severity: "warning",
        retryable: true
      };
    case "PlayerOpenHoldLimit":
      return {
        code: "PLAYER_OPEN_HOLD_LIMIT",
        message:
          "This wallet already has the most open bets allowed in this pool. Try again after one settles.",
        severity: "warning",
        retryable: true,
        details: { player: args?.[0] }
      };
    case "SolvencyViolation":
      return {
        code: "SOLVENCY_VIOLATION",
        message: "Operation would violate bank solvency constraints.",
        severity: "error"
      };
    case "OptionalOutflowDomainViolation":
      return {
        code: "OPTIONAL_OUTFLOW_DOMAIN_VIOLATION",
        message:
          "Optional outflow blocked: insufficient liquidity after the withdrawal buffer and reserves.",
        severity: "warning"
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
    case "ERC20InsufficientAllowance":
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
