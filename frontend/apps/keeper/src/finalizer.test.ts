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
  it("skips non-random-ready bets", async () => {
    const readBet = vi.fn(async () => bet("pendingVrf"));
    const simulateFinalize = vi.fn();
    const outcome = await finalizeIfReady(baseEvent, {
      readBet,
      simulateFinalize,
      writeFinalize: vi.fn(),
      waitFinalizeReceipt: vi.fn()
    });

    expect(outcome).toEqual({ kind: "skipped", state: "pendingVrf" });
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

    const outcome = await finalizeIfReady(baseEvent, {
      readBet,
      simulateFinalize: vi.fn(async () => undefined),
      writeFinalize: vi.fn(async () => "0xabc" as `0x${string}`),
      waitFinalizeReceipt: vi.fn(async () => ({ status: "success" as const })),
      now: vi.fn().mockReturnValueOnce(1_000).mockReturnValue(1_250)
    });

    expect(outcome).toEqual({ kind: "settled", txHash: "0xabc", latencyMs: 250 });
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
});

describe("retryDelayMs", () => {
  it("uses bounded backoff", () => {
    expect(retryDelayMs(0)).toBe(2_000);
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(99)).toBe(30_000);
  });
});
