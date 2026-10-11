import {
  BaseError,
  CallExecutionError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  HttpRequestError,
  InvalidInputRpcError,
  RpcRequestError
} from "viem";
import { describe, expect, it, vi } from "vitest";
import { GAME_HUB_KEEPER_ABI } from "./abi.js";
import { finalizeIfReady, retryDelayMs } from "./finalizer.js";
import type { BetRead, KeeperEvent } from "./types.js";

const baseEvent: KeeperEvent = {
  source: "gameHub",
  betId: 12n,
  requestId: 88n,
  receivedAt: 1_000
};

function bet(state: BetRead["state"]): BetRead {
  return { betId: 12n, requestId: 88n, state };
}

describe("finalizeIfReady", () => {
  it("skips nonexistent bets", async () => {
    const readBet = vi.fn(async () => bet("none"));
    const simulateFinalize = vi.fn();
    const outcome = await finalizeIfReady(baseEvent, {
      readRequest: vi.fn(async () => canonical("received")),
      readBet,
      simulateFinalize,
      writeFinalize: vi.fn(),
      waitFinalizeReceipt: vi.fn()
    });

    expect(outcome).toEqual({ kind: "skipped", state: "none" });
    expect(simulateFinalize).not.toHaveBeenCalled();
  });

  it("treats already terminal bets as raced success", async () => {
    const outcome = await finalizeIfReady(baseEvent, {
      readRequest: vi.fn(async () => canonical("received")),
      readBet: vi.fn(async () => bet("settled")),
      simulateFinalize: vi.fn(),
      writeFinalize: vi.fn(),
      waitFinalizeReceipt: vi.fn()
    });

    expect(outcome).toEqual({ kind: "raced", state: "settled" });
  });

  it("simulates, writes, waits, and verifies settlement", async () => {
    const readBet = vi
      .fn()
      .mockResolvedValueOnce(bet("randomReady"))
      .mockResolvedValueOnce(bet("settled"));
    const materializeReceipt = vi.fn(async () => undefined);

    const outcome = await finalizeIfReady(baseEvent, {
      readRequest: vi.fn(async () => canonical("received")),
      readBet,
      simulateFinalize: vi.fn(async () => undefined),
      writeFinalize: vi.fn(async () => "0xabc" as `0x${string}`),
      waitFinalizeReceipt: vi.fn(async () => ({ status: "success" as const })),
      materializeReceipt,
      now: vi.fn().mockReturnValueOnce(1_000).mockReturnValue(1_250)
    });

    expect(outcome).toEqual({ kind: "settled", txHash: "0xabc", latencyMs: 250 });
    expect(materializeReceipt).toHaveBeenCalledWith(baseEvent, "0xabc");
  });

  it("does not fail settlement when receipt materialization fails", async () => {
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn()
    };
    const outcome = await finalizeIfReady(baseEvent, {
      readRequest: vi.fn(async () => canonical("received")),
      readBet: vi
        .fn()
        .mockResolvedValueOnce(bet("randomReady"))
        .mockResolvedValueOnce(bet("settled")),
      simulateFinalize: vi.fn(async () => undefined),
      writeFinalize: vi.fn(async () => "0xabc" as `0x${string}`),
      waitFinalizeReceipt: vi.fn(async () => ({ status: "success" as const })),
      materializeReceipt: vi.fn(async () => {
        throw new Error("postgres unavailable");
      }),
      logger
    });

    expect(outcome).toEqual(expect.objectContaining({ kind: "settled", txHash: "0xabc" }));
    expect(logger.warn).toHaveBeenCalledWith(
      "casino.finalize.receipt_materialize_failed",
      expect.objectContaining({
        betId: "12",
        error: "Error: postgres unavailable",
        txHash: "0xabc"
      })
    );
  });

  it("waits through a stale post-receipt read before declaring failure", async () => {
    const readBet = vi
      .fn()
      .mockResolvedValueOnce(bet("randomReady"))
      .mockResolvedValueOnce(bet("randomReady"))
      .mockResolvedValueOnce(bet("settled"));
    const sleep = vi.fn(async () => undefined);

    const outcome = await finalizeIfReady(baseEvent, {
      readRequest: vi.fn(async () => canonical("received")),
      readBet,
      simulateFinalize: vi.fn(async () => undefined),
      writeFinalize: vi.fn(async () => "0xabc" as `0x${string}`),
      waitFinalizeReceipt: vi.fn(async () => ({ status: "success" as const })),
      sleep,
      verifyAttempts: 3,
      verifyDelayMs: 25
    });

    expect(outcome).toEqual(expect.objectContaining({ kind: "settled", txHash: "0xabc" }));
    expect(sleep).toHaveBeenCalledWith(25);
  });

  it("marks reverted receipts retryable", async () => {
    const outcome = await finalizeIfReady(baseEvent, {
      readRequest: vi.fn(async () => canonical("received")),
      readBet: vi.fn(async () => bet("randomReady")),
      simulateFinalize: vi.fn(async () => undefined),
      writeFinalize: vi.fn(async () => "0xabc" as `0x${string}`),
      waitFinalizeReceipt: vi.fn(async () => ({ status: "reverted" as const }))
    });

    expect(outcome.kind).toBe("failed");
    expect(outcome).toMatchObject({ retryable: true });
  });

  it("keeps the RPC URL out of a failure reason, which the health snapshot publishes", async () => {
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const outcome = await finalizeIfReady(baseEvent, {
      readRequest: vi.fn(async () => canonical("received")),
      readBet: vi.fn(async () => bet("randomReady")),
      simulateFinalize: vi.fn(async () => {
        throw new HttpRequestError({
          body: { method: "eth_call" },
          status: 429,
          url: "https://base-mainnet.infura.io/v3/rpc-api-key"
        });
      }),
      writeFinalize: vi.fn(),
      waitFinalizeReceipt: vi.fn(),
      logger
    });

    const reason = "HttpRequestError [status=429]: HTTP request failed.";
    expect(outcome).toEqual({ kind: "failed", reason, retryable: true });
    expect(logger.error).toHaveBeenCalledWith("casino.finalize.failed", {
      betId: "12",
      error: reason
    });
  });
});

describe("retryDelayMs", () => {
  it("uses bounded backoff", () => {
    expect(retryDelayMs(0)).toBe(2_000);
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(99)).toBe(30_000);
  });
});

describe("PendingVRF terminalization", () => {
  const pending = () => ({ ...bet("pendingVrf"), refundDeadline: 200n });
  function deps() {
    return {
      readRequest: vi.fn(async () => canonical("awaiting")),
      readBet: vi.fn().mockResolvedValue(pending()),
      readRefundClock: vi.fn().mockResolvedValue({ timestamp: 199n }),
      simulateRefund: vi.fn().mockResolvedValue(undefined),
      writeRefund: vi.fn().mockResolvedValue("0xabc"),
      simulateFinalize: vi.fn().mockResolvedValue(undefined),
      writeFinalize: vi.fn().mockResolvedValue("0xdef"),
      waitFinalizeReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      verifyAttempts: 1
    };
  }
  it.each([199n, 100_000n])(
    "finalizes Received+PendingVRF at chain time %s without refunding",
    async (timestamp) => {
      const d = deps();
      d.readRequest.mockResolvedValue(canonical("received"));
      d.readRefundClock.mockResolvedValue({ timestamp });
      d.readBet.mockResolvedValueOnce(pending()).mockResolvedValueOnce(bet("settled"));
      expect(await finalizeIfReady(baseEvent, d)).toMatchObject({
        kind: "settled",
        txHash: "0xdef"
      });
      expect(d.readRefundClock).not.toHaveBeenCalled();
      expect(d.writeRefund).not.toHaveBeenCalled();
    }
  );
  it("fails closed when canonical state is unreadable even after the refund deadline", async () => {
    const d = deps();
    d.readRefundClock.mockResolvedValue({ timestamp: 100_000n });
    d.readRequest.mockRejectedValue(new Error("canonical RPC unavailable"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "failed", retryable: true });
    expect(d.writeRefund).not.toHaveBeenCalled();
    expect(d.writeFinalize).not.toHaveBeenCalled();
  });
  it("reconciles terminal/cancelled canonical state against Hub instead of attempting refund", async () => {
    const d = deps();
    d.readRequest.mockResolvedValue(canonical("cancelled"));
    d.readBet.mockResolvedValueOnce(pending()).mockResolvedValueOnce(bet("refunded"));
    expect(await finalizeIfReady(baseEvent, d)).toEqual({ kind: "raced", state: "refunded" });
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("keeps an ineligible bet scheduled until its fixed deadline", async () => {
    const d = deps();
    expect(await finalizeIfReady(baseEvent, d)).toEqual({
      kind: "deferred",
      state: "pendingVrf",
      retryAfterMs: 1000
    });
    expect(d.writeRefund).not.toHaveBeenCalled();
    d.readRefundClock.mockResolvedValue({ timestamp: 200n });
    d.readBet.mockResolvedValueOnce(pending()).mockResolvedValueOnce(bet("refunded"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "settled", txHash: "0xabc" });
    expect(d.simulateRefund).toHaveBeenCalledWith(12n);
    expect(d.writeFinalize).not.toHaveBeenCalled();
  });
  it("fails closed when a pending bet has no valid stored deadline", async () => {
    const d = deps();
    d.readBet.mockResolvedValue({ ...pending(), refundDeadline: 0n });
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "failed", retryable: true });
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("never sends a timeout refund for RandomReady even long after placement", async () => {
    const d = deps();
    d.readRequest.mockResolvedValue(canonical("received"));
    d.readBet.mockResolvedValueOnce(bet("randomReady")).mockResolvedValueOnce(bet("settled"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "settled", txHash: "0xdef" });
    expect(d.readRefundClock).not.toHaveBeenCalled();
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("reconciles another caller's successful refund as a race", async () => {
    const d = deps();
    d.readRefundClock.mockResolvedValue({ timestamp: 200n });
    d.readBet.mockResolvedValueOnce(pending()).mockResolvedValueOnce(bet("refunded"));
    d.simulateRefund.mockRejectedValue(new Error("BadState"));
    expect(await finalizeIfReady(baseEvent, d)).toEqual({ kind: "raced", state: "refunded" });
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("retries a callback racing the refund, then finalizes its actual result", async () => {
    const d = deps();
    d.readRefundClock.mockResolvedValue({ timestamp: 200n });
    d.readBet.mockResolvedValueOnce(pending()).mockResolvedValueOnce(bet("randomReady"));
    d.simulateRefund.mockRejectedValue(new Error("BadState"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "failed", retryable: true });
    d.readRequest.mockResolvedValue(canonical("received"));
    d.readBet.mockResolvedValueOnce(bet("randomReady")).mockResolvedValueOnce(bet("settled"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "settled", txHash: "0xdef" });
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("reports missing refund reads as failure instead of silently skipping a pending bet", async () => {
    expect(
      await finalizeIfReady(baseEvent, {
        readRequest: vi.fn(async () => canonical("awaiting")),
        readBet: vi.fn(async () => bet("pendingVrf")),
        simulateFinalize: vi.fn(),
        writeFinalize: vi.fn(),
        waitFinalizeReceipt: vi.fn()
      })
    ).toMatchObject({ kind: "failed", retryable: true });
  });
});

describe("unbookable received results", () => {
  // A frozen asset makes the settlement transfer revert; the result can then never be booked.
  const settlementRevert = () =>
    new BaseError("finalize simulation reverted", {
      cause: new ContractFunctionRevertedError({
        abi: GAME_HUB_KEEPER_ABI,
        functionName: "finalize",
        data: encodeErrorResult({
          abi: GAME_HUB_KEEPER_ABI,
          errorName: "SafeERC20FailedOperation",
          args: ["0x0000000000000000000000000000000000000001"]
        })
      })
    });
  function deps(eligibleAt: bigint, chainTime: bigint) {
    return {
      readRequest: vi.fn(async () => canonical("received")),
      readBet: vi.fn(
        async (): Promise<BetRead> => ({ ...bet("randomReady"), vrfRequestedAt: 1_000n })
      ),
      simulateFinalize: vi.fn(async () => {
        throw settlementRevert();
      }),
      writeFinalize: vi.fn(),
      waitFinalizeReceipt: vi.fn(),
      assessVoid: vi.fn(async () => ({ eligibleAt, chainTime }))
    };
  }

  it.each([
    ["seven days away", 605_800n, 1_000n, 60_000],
    ["thirty seconds away", 1_030n, 1_000n, 30_000],
    ["already eligible", 87_400n, 90_000n, 60_000]
  ])(
    "defers a reverting settlement whose void is %s, rechecking at least once a minute",
    async (_case, eligibleAt, chainTime, retryAfterMs) => {
      const d = deps(eligibleAt, chainTime);
      expect(await finalizeIfReady(baseEvent, d)).toEqual({
        kind: "deferred",
        state: "randomReady",
        retryAfterMs,
        voidEligibleAt: eligibleAt
      });
      expect(d.assessVoid).toHaveBeenCalledWith(
        expect.objectContaining({ betId: 12n, vrfRequestedAt: 1_000n }),
        expect.stringContaining("SafeERC20FailedOperation"),
        baseEvent
      );
      expect(d.writeFinalize).not.toHaveBeenCalled();
    }
  );

  it("treats a PendingVRF bet whose canonical request was received the same way", async () => {
    const d = deps(605_800n, 1_000n);
    d.readBet.mockResolvedValue({
      ...bet("pendingVrf"),
      vrfRequestedAt: 1_000n,
      refundDeadline: 5n
    });
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({
      kind: "deferred",
      state: "pendingVrf",
      voidEligibleAt: 605_800n
    });
  });

  it("treats a settlement that runs out of the finalize gas as unbookable now", async () => {
    const d = deps(605_800n, 1_000n);
    d.simulateFinalize.mockRejectedValue(
      new ContractFunctionExecutionError(
        new CallExecutionError(
          new InvalidInputRpcError(
            new RpcRequestError({
              body: { method: "eth_call" },
              error: { code: -32000, message: "out of gas" },
              url: "https://rpc.invalid"
            })
          ),
          {}
        ),
        { abi: GAME_HUB_KEEPER_ABI, functionName: "finalize", args: [12n] }
      )
    );
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({
      kind: "deferred",
      voidEligibleAt: 605_800n
    });
    expect(d.assessVoid).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("out of gas"),
      baseEvent
    );
  });

  it("keeps a transport failure of the finalize simulation an ordinary retryable failure", async () => {
    const d = deps(605_800n, 1_000n);
    d.simulateFinalize.mockRejectedValue(
      new HttpRequestError({
        body: { method: "eth_call" },
        status: 503,
        url: "https://rpc.invalid"
      })
    );
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "failed", retryable: true });
    expect(d.assessVoid).not.toHaveBeenCalled();
  });

  it("reconciles a GameHub state race instead of treating it as an unbookable result", async () => {
    const d = deps(605_800n, 1_000n);
    d.simulateFinalize.mockRejectedValue(
      new BaseError("finalize simulation reverted", {
        cause: new ContractFunctionRevertedError({
          abi: GAME_HUB_KEEPER_ABI,
          functionName: "finalize",
          data: encodeErrorResult({
            abi: GAME_HUB_KEEPER_ABI,
            errorName: "BadState",
            args: [12n, 4, 3]
          })
        })
      })
    );
    d.readBet
      .mockResolvedValueOnce({ ...bet("randomReady"), vrfRequestedAt: 1_000n })
      .mockResolvedValueOnce(bet("settled"));
    expect(await finalizeIfReady(baseEvent, d)).toEqual({ kind: "raced", state: "settled" });
    expect(d.assessVoid).not.toHaveBeenCalled();
  });

  it("fails retryably when the void eligibility cannot be read", async () => {
    const d = deps(605_800n, 1_000n);
    d.assessVoid.mockRejectedValue(new Error("voidCohortEnd unavailable"));
    expect(await finalizeIfReady(baseEvent, d)).toEqual({
      kind: "failed",
      reason: "Error: voidCohortEnd unavailable",
      retryable: true
    });
  });

  it("stays a failure where no void executor is wired", async () => {
    const { assessVoid: _unused, ...d } = deps(605_800n, 1_000n);
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "failed", retryable: true });
  });
});

function canonical(state: "received" | "awaiting" | "cancelled" | "terminal") {
  return {
    state,
    bank: "0x0000000000000000000000000000000000000001" as const,
    hub: "0x0000000000000000000000000000000000000001" as const,
    betId: 12n
  };
}
