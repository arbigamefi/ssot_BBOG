import { HttpRequestError } from "viem";
import { describe, expect, it, vi } from "vitest";
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
  const pending = () => ({ ...bet("pendingVrf"), placedAt: 100n });
  function deps() {
    return {
      readBet: vi.fn().mockResolvedValue(pending()),
      readRefundClock: vi.fn().mockResolvedValue({ timestamp: 199n, timeoutSeconds: 100n }),
      simulateRefund: vi.fn().mockResolvedValue(undefined),
      writeRefund: vi.fn().mockResolvedValue("0xabc"),
      simulateFinalize: vi.fn().mockResolvedValue(undefined),
      writeFinalize: vi.fn().mockResolvedValue("0xdef"),
      waitFinalizeReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      verifyAttempts: 1
    };
  }
  it("keeps an ineligible bet scheduled and honors a shortened current timeout", async () => {
    const d = deps();
    expect(await finalizeIfReady(baseEvent, d)).toEqual({
      kind: "deferred",
      state: "pendingVrf",
      retryAfterMs: 1000
    });
    expect(d.writeRefund).not.toHaveBeenCalled();
    d.readRefundClock.mockResolvedValue({ timestamp: 199n, timeoutSeconds: 99n });
    d.readBet.mockResolvedValueOnce(pending()).mockResolvedValueOnce(bet("refunded"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "settled", txHash: "0xabc" });
    expect(d.simulateRefund).toHaveBeenCalledWith(12n);
    expect(d.writeFinalize).not.toHaveBeenCalled();
  });
  it("does not reuse a stale timeout when governance lengthens it", async () => {
    const d = deps();
    d.readRefundClock.mockResolvedValue({ timestamp: 200n, timeoutSeconds: 86_400n });
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({
      kind: "deferred",
      retryAfterMs: 60_000
    });
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("never sends a timeout refund for RandomReady even long after placement", async () => {
    const d = deps();
    d.readBet.mockResolvedValueOnce(bet("randomReady")).mockResolvedValueOnce(bet("settled"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "settled", txHash: "0xdef" });
    expect(d.readRefundClock).not.toHaveBeenCalled();
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("reconciles another caller's successful refund as a race", async () => {
    const d = deps();
    d.readRefundClock.mockResolvedValue({ timestamp: 200n, timeoutSeconds: 100n });
    d.readBet.mockResolvedValueOnce(pending()).mockResolvedValueOnce(bet("refunded"));
    d.simulateRefund.mockRejectedValue(new Error("BadState"));
    expect(await finalizeIfReady(baseEvent, d)).toEqual({ kind: "raced", state: "refunded" });
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("retries a callback racing the refund, then finalizes its actual result", async () => {
    const d = deps();
    d.readRefundClock.mockResolvedValue({ timestamp: 200n, timeoutSeconds: 100n });
    d.readBet.mockResolvedValueOnce(pending()).mockResolvedValueOnce(bet("randomReady"));
    d.simulateRefund.mockRejectedValue(new Error("BadState"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "failed", retryable: true });
    d.readBet.mockResolvedValueOnce(bet("randomReady")).mockResolvedValueOnce(bet("settled"));
    expect(await finalizeIfReady(baseEvent, d)).toMatchObject({ kind: "settled", txHash: "0xdef" });
    expect(d.writeRefund).not.toHaveBeenCalled();
  });
  it("reports missing refund reads as failure instead of silently skipping a pending bet", async () => {
    expect(
      await finalizeIfReady(baseEvent, {
        readBet: vi.fn(async () => bet("pendingVrf")),
        simulateFinalize: vi.fn(),
        writeFinalize: vi.fn(),
        waitFinalizeReceipt: vi.fn()
      })
    ).toMatchObject({ kind: "failed", retryable: true });
  });
});
