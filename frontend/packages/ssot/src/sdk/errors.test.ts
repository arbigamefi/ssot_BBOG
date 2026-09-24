import { describe, it, expect } from "vitest";
import { BaseError } from "viem";
import { toDomainError } from "./errors";

// Minimal mock helpers — we construct objects that look like viem errors
// for each branch inside toDomainError.

function makeBaseError(name: string, extra?: Record<string, unknown>): BaseError {
  const e = new BaseError("mock", { name } as any);
  Object.defineProperty(e, "name", { value: name, writable: true });
  if (extra) Object.assign(e, extra);
  return e;
}

describe("toDomainError", () => {
  it.each([
    [{ code: 4001 }, "USER_REJECTED"],
    [{ name: "InsufficientFundsError" }, "INSUFFICIENT_NATIVE_BALANCE"],
    [{ name: "ChainMismatchError" }, "CHAIN_MISMATCH"],
    [{ code: 4900 }, "RPC_ERROR"],
    [{ name: "BetContextChangedError" }, "BET_CONTEXT_CHANGED"]
  ])("unwraps wallet/provider causes without relying on message text", (cause, code) => {
    expect(toDomainError({ name: "TransactionExecutionError", cause: { cause } }).code).toBe(code);
  });
  it("bounds malformed cyclic cause chains", () => {
    const cyclic: any = { message: "bad provider" };
    cyclic.cause = cyclic;
    expect(toDomainError(cyclic).code).toBe("UNKNOWN");
  });

  // ——— User rejected ———
  it("maps UserRejectedRequestError → USER_REJECTED", () => {
    const err = makeBaseError("UserRejectedRequestError");
    const d = toDomainError(err);
    expect(d.code).toBe("USER_REJECTED");
    expect(d.severity).toBe("info");
    expect(d.retryable).toBe(true);
  });

  // ——— Contract revert ———
  it("maps ContractFunctionRevertedError → mapRevert (RiskInPaused)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "RiskInPaused", args: ["0xABC"] };
    const d = toDomainError(err);
    expect(d.code).toBe("RISK_IN_PAUSED");
    expect(d.severity).toBe("warning");
  });

  it("maps ContractFunctionRevertedError → mapRevert (UnknownAsset)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "UnknownAsset", args: ["0xDEAD"] };
    const d = toDomainError(err);
    expect(d.code).toBe("UNKNOWN_ASSET");
    expect(d.details).toEqual({ asset: "0xDEAD" });
  });

  it("maps ContractFunctionRevertedError → mapRevert (UnknownGame)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "UnknownGame", args: ["0xGAME"] };
    const d = toDomainError(err);
    expect(d.code).toBe("UNKNOWN_GAME");
    expect(d.details).toEqual({ gameId: "0xGAME" });
  });

  it("maps ContractFunctionRevertedError → mapRevert (InsufficientVRFFee)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "InsufficientVRFFee", args: [100n, 200n] };
    const d = toDomainError(err);
    expect(d.code).toBe("INSUFFICIENT_VRF_FEE");
    expect(d.details).toEqual({ paid: 100n, required: 200n });
  });

  it("maps ContractFunctionRevertedError → mapRevert (HouseEdgeTooHigh)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "HouseEdgeTooHigh", args: [500, 300] };
    const d = toDomainError(err);
    expect(d.code).toBe("HOUSE_EDGE_TOO_HIGH");
    expect(d.details).toEqual({ got: 500, maxAllowed: 300 });
  });

  it("maps ContractFunctionRevertedError → mapRevert (HouseEdgeTooLow)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "HouseEdgeTooLow", args: [10, 50] };
    const d = toDomainError(err);
    expect(d.code).toBe("HOUSE_EDGE_TOO_LOW");
    expect(d.details).toEqual({ got: 10, minAllowed: 50 });
  });

  it("maps ContractFunctionRevertedError → mapRevert (RefundNotReady)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "RefundNotReady", args: [1n, 100, 200] };
    const d = toDomainError(err);
    expect(d.code).toBe("REFUND_NOT_READY");
    expect(d.retryable).toBe(true);
    expect(d.details).toEqual({ betId: 1n, nowTs: 100, readyAt: 200 });
  });

  it("maps ContractFunctionRevertedError → mapRevert (BadState)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "BadState", args: [42n, 1, 2] };
    const d = toDomainError(err);
    expect(d.code).toBe("BAD_STATE");
    expect(d.details).toEqual({ betId: 42n, got: 1, want: 2 });
  });

  // ——— New Hub error mappings ———
  it("maps ContractFunctionRevertedError → mapRevert (BetNotFound)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "BetNotFound", args: [99n] };
    const d = toDomainError(err);
    expect(d.code).toBe("BET_NOT_FOUND");
    expect(d.details).toEqual({ betId: 99n });
  });

  it("maps ContractFunctionRevertedError → mapRevert (NotVRFHub)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "NotVRFHub", args: [] };
    const d = toDomainError(err);
    expect(d.code).toBe("NOT_VRF_HUB");
    expect(d.severity).toBe("error");
  });

  it("maps ContractFunctionRevertedError → mapRevert (InsufficientBalance)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "InsufficientBalance", args: [] };
    const d = toDomainError(err);
    expect(d.code).toBe("INSUFFICIENT_BALANCE");
  });

  it("maps ContractFunctionRevertedError → mapRevert (InvalidBps)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "InvalidBps", args: [15000n] };
    const d = toDomainError(err);
    expect(d.code).toBe("INVALID_BPS");
    expect(d.details).toEqual({ bps: 15000n });
  });

  it("maps ContractFunctionRevertedError → mapRevert (InvalidConfig)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "InvalidConfig", args: [] };
    const d = toDomainError(err);
    expect(d.code).toBe("INVALID_CONFIG");
  });

  it("maps ContractFunctionRevertedError → mapRevert (ZeroAddress)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "ZeroAddress", args: [] };
    const d = toDomainError(err);
    expect(d.code).toBe("ZERO_ADDRESS");
  });

  // ——— New Bank error mappings ———
  it("maps ContractFunctionRevertedError → mapRevert (BetAlreadyExists)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "BetAlreadyExists", args: [5n] };
    const d = toDomainError(err);
    expect(d.code).toBe("BET_ALREADY_EXISTS");
    expect(d.details).toEqual({ betId: 5n });
  });

  it("maps ContractFunctionRevertedError → mapRevert (BetNotOpen)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "BetNotOpen", args: [7n] };
    const d = toDomainError(err);
    expect(d.code).toBe("BET_NOT_OPEN");
    expect(d.details).toEqual({ betId: 7n });
  });

  it("maps ContractFunctionRevertedError → mapRevert (ReservedTooSmall)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "ReservedTooSmall", args: [1n, 100n, 200n] };
    const d = toDomainError(err);
    expect(d.code).toBe("RESERVED_TOO_SMALL");
    expect(d.details).toEqual({ betId: 1n, reserved: 100n, need: 200n });
  });

  it("maps ContractFunctionRevertedError → mapRevert (RefundTooLarge)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "RefundTooLarge", args: [1n, 500n, 300n] };
    const d = toDomainError(err);
    expect(d.code).toBe("REFUND_TOO_LARGE");
    expect(d.details).toEqual({ betId: 1n, refundAmount: 500n, stake: 300n });
  });

  it("maps ContractFunctionRevertedError → mapRevert (XPInvalidAward)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "XPInvalidAward", args: ["0xABC"] };
    const d = toDomainError(err);
    expect(d.code).toBe("XP_INVALID_AWARD");
    expect(d.details).toEqual({ payee: "0xABC" });
  });

  it("maps ContractFunctionRevertedError → mapRevert (XPTooManyAwards)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "XPTooManyAwards", args: [20n] };
    const d = toDomainError(err);
    expect(d.code).toBe("XP_TOO_MANY_AWARDS");
    expect(d.details).toEqual({ n: 20n });
  });

  it("maps ContractFunctionRevertedError → mapRevert (EnforcedPause)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "EnforcedPause", args: [] };
    const d = toDomainError(err);
    expect(d.code).toBe("ENFORCED_PAUSE");
    expect(d.severity).toBe("warning");
  });

  it("maps ContractFunctionRevertedError → mapRevert (InsufficientAllowance)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "InsufficientAllowance", args: [] };
    const d = toDomainError(err);
    expect(d.code).toBe("INSUFFICIENT_ALLOWANCE");
    expect(d.retryable).toBe(true);
  });

  it("maps ContractFunctionRevertedError → mapRevert (ReentrancyGuardReentrantCall)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "ReentrancyGuardReentrantCall", args: [] };
    const d = toDomainError(err);
    expect(d.code).toBe("REENTRANCY");
    expect(d.retryable).toBe(true);
  });

  it("maps ContractFunctionRevertedError → mapRevert (SafeERC20FailedOperation)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "SafeERC20FailedOperation", args: ["0xTOKEN"] };
    const d = toDomainError(err);
    expect(d.code).toBe("SAFE_ERC20_FAILED");
    expect(d.details).toEqual({ token: "0xTOKEN" });
  });

  it("maps ContractFunctionRevertedError → mapRevert (unknown error name)", () => {
    const err = makeBaseError("ContractFunctionRevertedError");
    (err as any).data = { errorName: "SomeNewError", args: [1, 2] };
    const d = toDomainError(err);
    expect(d.code).toBe("REVERT_SomeNewError");
    expect(d.message).toContain("SomeNewError");
    expect(d.details).toEqual({ args: [1, 2] });
  });

  // ——— Nested cause chain (ContractFunctionExecutionError → ContractFunctionRevertedError) ———
  it("unwraps nested ContractFunctionRevertedError from ContractFunctionExecutionError", () => {
    // Simulate viem's actual error structure: ExecutionError wraps RevertedError in .cause
    const innerErr = makeBaseError("ContractFunctionRevertedError");
    (innerErr as any).data = { errorName: "SolvencyViolation", args: [] };
    const outerErr = makeBaseError("ContractFunctionExecutionError");
    (outerErr as any).cause = innerErr;
    (outerErr as any).shortMessage = 'The contract function "placeBet" reverted.';

    const d = toDomainError(outerErr);
    expect(d.code).toBe("SOLVENCY_VIOLATION");
    expect(d.severity).toBe("error");
  });

  it("maps nested string revert (errorName=Error) to CONTRACT_REVERT with reason message", () => {
    const innerErr = makeBaseError("ContractFunctionRevertedError");
    (innerErr as any).data = { errorName: "Error", args: [] };
    (innerErr as any).shortMessage = "ERC20: transfer amount exceeds allowance";
    const outerErr = makeBaseError("ContractFunctionExecutionError");
    (outerErr as any).cause = innerErr;
    (outerErr as any).shortMessage =
      'The contract function "placeBet" reverted with the following reason:\nERC20: transfer amount exceeds allowance';

    const d = toDomainError(outerErr);
    expect(d.code).toBe("CONTRACT_REVERT");
    expect(d.message).toContain("ERC20: transfer amount exceeds allowance");
  });

  // ——— RPC/HTTP errors ———
  it("maps HttpRequestError → RPC_ERROR", () => {
    const err = makeBaseError("HttpRequestError");
    (err as any).shortMessage = "503 Service Unavailable";
    const d = toDomainError(err);
    expect(d.code).toBe("RPC_ERROR");
    expect(d.message).toBe("503 Service Unavailable");
    expect(d.retryable).toBe(true);
  });

  it("maps RpcRequestError → RPC_ERROR", () => {
    const err = makeBaseError("RpcRequestError");
    const d = toDomainError(err);
    expect(d.code).toBe("RPC_ERROR");
    expect(d.retryable).toBe(true);
  });

  // ——— Other BaseError ———
  it("maps unknown BaseError to generic domain error", () => {
    const err = makeBaseError("TransactionNotFoundError");
    (err as any).shortMessage = "tx not found";
    const d = toDomainError(err);
    expect(d.code).toBe("TransactionNotFoundError");
    expect(d.message).toBe("tx not found");
    expect(d.retryable).toBe(true);
  });

  // ——— Non-BaseError ———
  it("maps plain Error → UNKNOWN", () => {
    const err = new Error("something went wrong");
    const d = toDomainError(err);
    expect(d.code).toBe("UNKNOWN");
    expect(d.message).toBe("something went wrong");
    expect(d.severity).toBe("error");
  });

  it("maps string → UNKNOWN", () => {
    const d = toDomainError("oops");
    expect(d.code).toBe("UNKNOWN");
    expect(d.message).toBe("oops");
  });

  it("maps undefined → UNKNOWN", () => {
    const d = toDomainError(undefined);
    expect(d.code).toBe("UNKNOWN");
  });
});
