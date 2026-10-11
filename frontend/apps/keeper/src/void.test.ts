import {
  BaseError,
  CallExecutionError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  getAddress,
  HttpRequestError,
  InvalidInputRpcError,
  RpcRequestError,
  type Address,
  type Hex
} from "viem";
import { describe, expect, it, vi } from "vitest";
import { BANK_KEEPER_ABI, GAME_HUB_KEEPER_ABI } from "./abi.js";
import type { BetRead, BetStateName, RequestStateName } from "./types.js";
import {
  attemptVoid,
  checkVoidGasLimit,
  compareVoidCandidates,
  decodeVoidReceipt,
  DEFAULT_VOID_GAS_LIMIT,
  isSettlementFailure,
  minimumVoidGasLimit,
  VoidConfigurationError,
  voidEligibleAt,
  type VoidAttemptDeps,
  type VoidCandidate,
  type VoidParameters
} from "./void.js";

const gameHub = "0x00000000000000000000000000000000000000a6" as Address;
const bank = "0x00000000000000000000000000000000000000b1" as Address;
const keeper = "0x00000000000000000000000000000000000000c1" as Address;
const txHash = `0x${"ab".repeat(32)}` as Hex;
const prefix = `0x${"fb8f41b2"}${"00".repeat(28)}` as Hex;
const parameters: VoidParameters = {
  voidDelay: 86_400n,
  publicVoidDelay: 604_800n,
  settlementGas: 10_000_000n,
  reserveGas: 600_000n,
  callOverhead: 5_000n
};

function revert(errorName: string, args: readonly unknown[] = [], functionName = "voidBet") {
  return new BaseError(`${functionName} simulation reverted`, {
    cause: new ContractFunctionRevertedError({
      abi: GAME_HUB_KEEPER_ABI,
      functionName,
      data: encodeErrorResult({ abi: GAME_HUB_KEEPER_ABI, errorName, args } as never)
    })
  });
}

function gameHubLog(eventName: "BetVoided" | "BetFinalized", betId: bigint, stake = 1_000n) {
  return {
    address: gameHub,
    topics: encodeEventTopics({
      abi: GAME_HUB_KEEPER_ABI,
      eventName,
      args:
        eventName === "BetVoided" ? { positionId: betId, caller: keeper } : { positionId: betId }
    } as never) as Hex[],
    data:
      eventName === "BetVoided"
        ? encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [stake, prefix])
        : encodeAbiParameters(
            Array.from({ length: 4 }, () => ({ type: "uint256" as const })),
            [0n, 0n, 0n, 0n]
          )
  };
}

function bankVoidedLog(betId: bigint, stake = 1_000n) {
  return {
    address: bank,
    topics: encodeEventTopics({
      abi: BANK_KEEPER_ABI,
      eventName: "BetVoided",
      args: { betId, player: keeper }
    } as never) as Hex[],
    data: encodeAbiParameters([{ type: "uint256" }], [stake])
  };
}

describe("void parameters", () => {
  it("needs the GameHub floor plus 150,000 and stays under Base's transaction cap", () => {
    expect(minimumVoidGasLimit(parameters)).toBe(10_755_000n);
    for (const gas of [10_755_000n, DEFAULT_VOID_GAS_LIMIT, 16_000_000n])
      expect(() => checkVoidGasLimit(gas, parameters)).not.toThrow();
    for (const gas of [10_754_999n, 16_000_001n, 0n])
      expect(() => checkVoidGasLimit(gas, parameters)).toThrow(VoidConfigurationError);
    expect(() => checkVoidGasLimit(10_000_000n, parameters)).toThrow(
      "KEEPER_VOID_GAS_LIMIT=10000000 must be at least 10755000 (VOID_SETTLEMENT_GAS 10000000 + " +
        "VOID_RESERVE_GAS 600000 + VOID_CALL_OVERHEAD 5000 + 150000) and at most 16000000"
    );
  });

  it("allows a void 24 hours after a request inside the Bank's window and 7 days after any other", () => {
    expect(voidEligibleAt(1_000n, 1_000n, parameters)).toBe(87_400n);
    expect(voidEligibleAt(1_000n, 999n, parameters)).toBe(605_800n);
    expect(voidEligibleAt(1_000n, 0n, parameters)).toBe(605_800n);
  });

  it("orders candidates by VRF request time, then bet ID", () => {
    const candidate = (betId: bigint, vrfRequestedAt: bigint): VoidCandidate => ({
      betId,
      bank,
      vrfRequestedAt,
      receivedAt: vrfRequestedAt,
      receivedFrom: "request",
      eligibleAt: 0n,
      reason: ""
    });
    expect(
      [candidate(1n, 30n), candidate(4n, 10n), candidate(3n, 20n), candidate(2n, 10n)]
        .sort(compareVoidCandidates)
        .map((item) => item.betId)
    ).toEqual([2n, 4n, 3n, 1n]);
  });
});

/** A node's execution error as viem reports it, for example geth's "out of gas". */
function nodeError(message: string, code = -32000) {
  return new ContractFunctionExecutionError(
    new CallExecutionError(
      new InvalidInputRpcError(
        new RpcRequestError({ body: {}, error: { code, message }, url: "http://rpc.invalid" })
      ),
      {}
    ),
    { abi: GAME_HUB_KEEPER_ABI, functionName: "finalize", args: [7n] }
  );
}

describe("isSettlementFailure", () => {
  it("accepts a settlement revert or halt and refuses races, transport failures and other errors", () => {
    expect(isSettlementFailure(revert("SafeERC20FailedOperation", [bank], "finalize"))).toBe(true);
    expect(isSettlementFailure(revert("InvalidModuleResult", [], "finalize"))).toBe(true);
    // A settlement that needs more than the finalize gas: voidBet retries it with 10M first.
    expect(isSettlementFailure(nodeError("out of gas"))).toBe(true);
    expect(isSettlementFailure(nodeError("header not found"))).toBe(false);
    for (const [errorName, args] of [
      ["BadState", [7n, 4, 3]],
      ["BetNotFound", [7n]],
      ["InvalidRandomReceipt", []]
    ] as const)
      expect(isSettlementFailure(revert(errorName, args, "finalize"))).toBe(false);
    expect(
      isSettlementFailure(new HttpRequestError({ status: 503, url: "https://rpc.invalid" }))
    ).toBe(false);
    expect(isSettlementFailure(new Error("execution reverted"))).toBe(false);
  });
});

describe("decodeVoidReceipt", () => {
  it("reads GameHub BetVoided for the bet, not the Bank's event of the same name", () => {
    expect(
      decodeVoidReceipt({
        betId: 7n,
        gameHub,
        logs: [bankVoidedLog(7n), gameHubLog("BetVoided", 8n), gameHubLog("BetVoided", 7n, 5_000n)]
      })
    ).toEqual({
      outcome: "voided",
      stake: 5_000n,
      caller: getAddress(keeper),
      settlementErrorPrefix: prefix
    });
  });

  it("reports a settlement inside voidBet and nothing for an unrelated receipt", () => {
    expect(
      decodeVoidReceipt({ betId: 7n, gameHub, logs: [gameHubLog("BetFinalized", 7n)] })
    ).toEqual({ outcome: "settled" });
    expect(decodeVoidReceipt({ betId: 7n, gameHub, logs: [bankVoidedLog(7n)] })).toBeUndefined();
    expect(
      decodeVoidReceipt({
        betId: 7n,
        gameHub,
        logs: [{ ...gameHubLog("BetVoided", 7n), address: bank }]
      })
    ).toBeUndefined();
  });
});

describe("attemptVoid", () => {
  const candidate: VoidCandidate = {
    betId: 7n,
    bank,
    vrfRequestedAt: 1_000n,
    receivedAt: 1_004n,
    receivedFrom: "result",
    eligibleAt: 87_400n,
    reason: "frozen asset"
  };
  function deps(
    overrides: Partial<VoidAttemptDeps> = {},
    state: BetStateName = "randomReady",
    request: RequestStateName = "received"
  ) {
    const bet: BetRead = { betId: 7n, requestId: 9n, state, bank, vrfRequestedAt: 1_000n };
    return {
      gameHub,
      gasLimit: DEFAULT_VOID_GAS_LIMIT,
      readBet: vi.fn(async () => bet),
      readRequest: vi.fn(async () => ({ bank, hub: gameHub, betId: 7n, state: request })),
      simulateFinalize: vi.fn(async () => {
        throw revert("SafeERC20FailedOperation", [bank], "finalize");
      }),
      simulateVoid: vi.fn(async () => true),
      writeVoid: vi.fn(async () => txHash),
      waitVoidReceipt: vi.fn(async () => ({
        status: "success" as const,
        logs: [bankVoidedLog(7n), gameHubLog("BetVoided", 7n)]
      })),
      materializeReceipt: vi.fn(async () => undefined),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      ...overrides
    };
  }

  it("simulates finalize, then simulates and sends voidBet, and reads the void from the receipt", async () => {
    const d = deps();
    expect(await attemptVoid(candidate, d)).toMatchObject({
      kind: "voided",
      txHash,
      stake: 1_000n,
      settlementErrorPrefix: prefix
    });
    expect(d.simulateFinalize).toHaveBeenCalledWith(7n);
    expect(d.simulateVoid).toHaveBeenCalledWith(7n);
    expect(d.writeVoid).toHaveBeenCalledWith(7n);
    expect(d.materializeReceipt).toHaveBeenCalledWith(7n, txHash);
    expect(d.logger.info).toHaveBeenCalledWith(
      "casino.void.broadcast",
      expect.objectContaining({ betId: "7", txHash, gasLimit: "11000000", simulated: "voided" })
    );
    expect(d.logger.info).toHaveBeenCalledWith(
      "casino.void.mined",
      expect.objectContaining({ betId: "7", outcome: "voided", stake: "1000" })
    );
  });

  it("works for a PendingVRF bet whose canonical request was received", async () => {
    expect(await attemptVoid(candidate, deps({}, "pendingVrf"))).toMatchObject({ kind: "voided" });
  });

  it("reports a settlement inside voidBet", async () => {
    const d = deps({
      simulateVoid: vi.fn(async () => false),
      waitVoidReceipt: vi.fn(async () => ({
        status: "success" as const,
        logs: [gameHubLog("BetFinalized", 7n)]
      }))
    });
    expect(await attemptVoid(candidate, d)).toMatchObject({ kind: "settled", txHash });
  });

  it("sends voidBet for a settlement that ran out of the finalize gas, and reads its settlement", async () => {
    const d = deps({
      simulateFinalize: vi.fn(async () => {
        throw nodeError("out of gas");
      }),
      simulateVoid: vi.fn(async () => false),
      waitVoidReceipt: vi.fn(async () => ({
        status: "success" as const,
        logs: [gameHubLog("BetFinalized", 7n)]
      }))
    });
    expect(await attemptVoid(candidate, d)).toMatchObject({ kind: "settled", txHash });
    expect(d.writeVoid).toHaveBeenCalledWith(7n);
  });

  it("hands a result that books again back to finalize without touching voidBet", async () => {
    const d = deps({ simulateFinalize: vi.fn(async () => undefined) });
    expect(await attemptVoid(candidate, d)).toEqual({ kind: "bookable" });
    expect(d.simulateVoid).not.toHaveBeenCalled();
    expect(d.writeVoid).not.toHaveBeenCalled();
  });

  it("does not void when the finalize simulation failed for a transport reason", async () => {
    const d = deps({
      simulateFinalize: vi.fn(async () => {
        throw new HttpRequestError({ status: 429, url: "https://rpc.invalid/key" });
      })
    });
    expect(await attemptVoid(candidate, d)).toMatchObject({
      kind: "failed",
      reason: expect.stringContaining("status=429")
    });
    expect(d.simulateVoid).not.toHaveBeenCalled();
  });

  it("treats VoidGasTooLow as a configuration error and sends nothing", async () => {
    const d = deps({
      simulateVoid: vi.fn(async () => {
        throw revert("VoidGasTooLow", [10_000_000n, 10_605_000n]);
      })
    });
    expect(await attemptVoid(candidate, d)).toMatchObject({
      kind: "configurationError",
      reason: expect.stringContaining("KEEPER_VOID_GAS_LIMIT=11000000")
    });
    expect(d.writeVoid).not.toHaveBeenCalled();
  });

  it("learns the eligibility time from VoidNotEligible and sends nothing", async () => {
    const d = deps({
      simulateVoid: vi.fn(async () => {
        throw revert("VoidNotEligible", [7n, 87_000n, 87_400n]);
      })
    });
    expect(await attemptVoid(candidate, d)).toEqual({ kind: "notEligible", eligibleAt: 87_400n });
    expect(d.writeVoid).not.toHaveBeenCalled();
  });

  it.each([
    ["voided", "received", { kind: "raced", state: "voided" }],
    ["settled", "terminal", { kind: "raced", state: "settled" }],
    ["held", "none", { kind: "dropped", reason: "bet is held" }],
    ["pendingVrf", "awaiting", { kind: "dropped", reason: "canonical VRF request is awaiting" }]
  ] as const)("leaves a %s bet alone", async (state, request, outcome) => {
    const d = deps({}, state, request);
    expect(await attemptVoid(candidate, d)).toEqual(outcome);
    expect(d.simulateVoid).not.toHaveBeenCalled();
  });

  it("keeps a reverted void transaction a failure unless the bet ended meanwhile", async () => {
    const reverted = deps({
      waitVoidReceipt: vi.fn(async () => ({ status: "reverted" as const, logs: [] }))
    });
    expect(await attemptVoid(candidate, reverted)).toEqual({
      kind: "failed",
      reason: "Error: voidBet transaction reverted",
      txHash
    });
    const raced = deps({
      waitVoidReceipt: vi.fn(async () => ({ status: "reverted" as const, logs: [] }))
    });
    vi.mocked(raced.readBet)
      .mockResolvedValueOnce({ betId: 7n, requestId: 9n, state: "randomReady", bank })
      .mockResolvedValueOnce({ betId: 7n, requestId: 9n, state: "voided", bank });
    expect(await attemptVoid(candidate, raced)).toEqual({ kind: "raced", state: "voided" });
  });

  it("fails a receipt that carries no outcome for the bet", async () => {
    const d = deps({
      waitVoidReceipt: vi.fn(async () => ({
        status: "success" as const,
        logs: [gameHubLog("BetVoided", 8n)]
      }))
    });
    expect(await attemptVoid(candidate, d)).toMatchObject({
      kind: "failed",
      reason: expect.stringContaining("neither BetVoided nor BetFinalized"),
      txHash
    });
  });
});
