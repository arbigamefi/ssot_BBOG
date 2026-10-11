import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app-shell/rpc", () => ({ resolvePublicWsRpcUrl: () => undefined }));

import { useCasinoRoundWatcher } from "./casino-round";

const nowSec = () => Math.floor(Date.now() / 1000);

/** A PendingVRF bet two hours old, past its refund deadline. */
function overdueBet() {
  return {
    betId: 7n,
    chainId: 84532,
    state: "placed",
    stake: 1_000_000n,
    houseEdgeBps: 200,
    requestId: 11n,
    placedAt: nowSec() - 7_200,
    refundDeadline: nowSec() - 60
  };
}

function voidStatus(resultReceived: boolean) {
  return {
    betId: 7n,
    voidable: false,
    eligibleAt: nowSec() + 86_400,
    inWindow: false,
    resultReceived,
    blockNumber: 1n,
    blockTimestamp: nowSec()
  };
}

/** A RandomReady bet whose seed is recorded; settlement may still fail. */
function randomReadyBet() {
  return { ...overdueBet(), state: "randomReady" };
}

function sdkWith({
  readVoidStatus = async () => voidStatus(true),
  refund = async () => ({ ok: true, txHash: `0x${"1".repeat(64)}` }),
  finalize = async () => ({ ok: true, txHash: `0x${"2".repeat(64)}` }),
  bet = overdueBet
}: {
  readVoidStatus?: () => Promise<unknown>;
  refund?: () => Promise<unknown>;
  finalize?: () => Promise<unknown>;
  bet?: () => unknown;
}) {
  return {
    release: { chainId: 84532 },
    gameHub: {
      getBet: vi.fn(async () => bet()),
      getVoidStatus: vi.fn(readVoidStatus),
      refund: vi.fn(refund),
      finalize: vi.fn(finalize)
    }
  } as any;
}

describe("casino round watcher and the timeout refund", () => {
  const unmounts: Array<() => void> = [];
  afterEach(() => {
    for (const unmount of unmounts.splice(0)) unmount();
  });

  function watch(sdk: any, pollIntervalMs?: number) {
    const hook = renderHook(() =>
      useCasinoRoundWatcher({
        sdk,
        betId: 7n,
        active: true,
        pollIntervalMs,
        refundErrorMessage: "Refund failed",
        manualSettleErrorMessage: "Settle failed"
      })
    );
    unmounts.push(hook.unmount);
    return hook;
  }

  it("never offers the refund for a received result; settlement is pending instead", async () => {
    const sdk = sdkWith({ readVoidStatus: async () => voidStatus(true) });
    const { result } = watch(sdk);

    await waitFor(() => expect(result.current.phase).toBe("result_unbooked"));
    expect(result.current.manualRefundAvailable).toBe(false);
    expect(result.current.isLive).toBe(false);
    expect(sdk.gameHub.getVoidStatus).toHaveBeenCalledWith(7n);
    expect(sdk.gameHub.refund).not.toHaveBeenCalled();
  });

  it("offers the refund once a read says the request still awaits its result", async () => {
    const sdk = sdkWith({ readVoidStatus: async () => voidStatus(false) });
    const { result } = watch(sdk);

    await waitFor(() => expect(result.current.phase).toBe("refundable"));
    expect(result.current.manualRefundAvailable).toBe(true);
  });

  it("keeps the refund hidden while the request cannot be read", async () => {
    const sdk = sdkWith({
      readVoidStatus: async () => {
        throw new Error("provider down");
      }
    });
    const { result } = watch(sdk);

    await waitFor(() => expect(sdk.gameHub.getVoidStatus).toHaveBeenCalled());
    await waitFor(() => expect(result.current.phase).toBe("timeout_soft"));
    expect(result.current.manualRefundAvailable).toBe(false);
  });

  it("moves to the void path when the refund finds the result already received", async () => {
    const sdk = sdkWith({
      readVoidStatus: async () => voidStatus(false),
      refund: async () => ({
        ok: false,
        txHash: "0x0",
        error: { code: "REVERT_InvalidRandomReceipt", message: "raw", severity: "error" }
      })
    });
    const { result } = watch(sdk);
    await waitFor(() => expect(result.current.manualRefundAvailable).toBe(true));

    await act(() => result.current.manualRefund());

    expect(result.current.phase).toBe("result_unbooked");
    expect(result.current.manualRefundAvailable).toBe(false);
    expect(result.current.error).toBeUndefined();
  });
  it("hands a RandomReady bet to the void path once the contract reverts its settlement", async () => {
    const sdk = sdkWith({
      bet: randomReadyBet,
      finalize: async () => ({
        ok: false,
        txHash: "0x0",
        error: { code: "REVERT_SettlementFailed", message: "raw", severity: "error" }
      })
    });
    const { result } = watch(sdk, 20);
    await waitFor(() => expect(result.current.phase).toBe("settling"));

    await act(() => result.current.manualSettle());

    expect(result.current.phase).toBe("result_unbooked");
    expect(result.current.manualSettleAvailable).toBe(false);
    expect(result.current.manualRefundAvailable).toBe(false);
    // Later polls keep it there: the bet is still RandomReady on chain.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sdk.gameHub.getBet.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.phase).toBe("result_unbooked");
  });

  it("keeps the manual settlement for a retry after a wallet cancellation", async () => {
    const sdk = sdkWith({
      bet: randomReadyBet,
      finalize: async () => ({
        ok: false,
        txHash: "0x0",
        error: { code: "USER_REJECTED", message: "raw", severity: "info" }
      })
    });
    const { result } = watch(sdk);
    await waitFor(() => expect(result.current.phase).toBe("settling"));

    await act(() => result.current.manualSettle());

    expect(result.current.phase).toBe("manual_settle_offered");
    expect(result.current.manualSettleAvailable).toBe(true);
    expect(result.current.error).toBe("Settle failed");
  });
});
