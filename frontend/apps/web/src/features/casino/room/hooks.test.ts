import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  formatTokenBalance,
  pickKenoStrobeSpots,
  useGameWalletBalance,
  usePlayerOpenHolds,
  usePoolSnapshot
} from "./hooks";

describe("game room hooks helpers", () => {
  it("formats bigint token balances with the selected asset symbol", () => {
    expect(formatTokenBalance(123456789n, 6, "USDC")).toBe("123.45 USDC");
    expect(formatTokenBalance(1000000000000000000n, 18, "WETH")).toBe("1 WETH");
  });

  it("picks unique keno strobe spots in the contract range", () => {
    const random = vi.spyOn(Math, "random");
    random
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.3);

    const spots = pickKenoStrobeSpots(4);

    expect(spots).toEqual([1, 2, 4, 5]);
    expect(new Set(spots).size).toBe(spots.length);
    expect(spots.every((spot) => spot >= 1 && spot <= 15)).toBe(true);
    random.mockRestore();
  });

  it("refreshes wallet balance when the external refresh key changes", async () => {
    const getAssetBalance = vi
      .fn()
      .mockResolvedValueOnce(100_000_000n)
      .mockResolvedValueOnce(90_000_000n);
    const sdk = {
      account: "0x0000000000000000000000000000000000000001" as const,
      bank: { getAssetBalance }
    };
    const asset = {
      address: "0x0000000000000000000000000000000000000002" as const,
      decimals: 6,
      symbol: "USDC"
    };

    const { result, rerender } = renderHook(
      ({ refreshKey }: { refreshKey: number }) =>
        useGameWalletBalance({ sdk, asset, refreshKey, refreshMs: 0 }),
      { initialProps: { refreshKey: 0 } }
    );

    await waitFor(() => expect(result.current?.label).toBe("100 USDC"));

    rerender({ refreshKey: 1 });

    await waitFor(() => expect(result.current?.label).toBe("90 USDC"));
    expect(getAssetBalance).toHaveBeenCalledTimes(2);
  });
});

describe("live pool availability", () => {
  const snapshot = {
    L: 100n,
    G: 120n,
    R: 30n,
    minBetAmount: 1n,
    openHolds: 1n,
    maxOpenHolds: 128n,
    accountingValid: true,
    riskInPaused: false,
    poolActive: true,
    riskReserveBps: 1000
  };
  it("keeps betting available when a received result gates only LP cash operations", async () => {
    const sdk = {
      bank: {
        getSnapshot: vi
          .fn()
          .mockResolvedValue({ ...snapshot, lpStatus: "unbookedResult", unbookedResultCount: 1n })
      }
    };
    const { result } = renderHook(() => usePoolSnapshot({ sdk, poolId: 1 }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
  it.each([
    [{ ...snapshot, openHolds: 128n }, "full"],
    [{ ...snapshot, L: 0n }, "noLiquidity"],
    [{ ...snapshot, accountingValid: false }, "invalidAccounting"],
    // ADR-0037 §9 D1: a registered pool takes LP deposits before betting starts.
    [{ ...snapshot, poolActive: false }, "inactive"],
    [{ ...snapshot, poolActive: false, riskInPaused: true }, "paused"]
  ])("blocks non-executable Bank state: %s", async (value, expected) => {
    const sdk = { bank: { getSnapshot: vi.fn().mockResolvedValue(value) } };
    const { result } = renderHook(() => usePoolSnapshot({ sdk, poolId: 1 }));
    await waitFor(() => expect(result.current.status).toBe(expected));
  });
  it("blocks until a read completes, shows pause, and refreshes after governance resumes", async () => {
    const getSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ ...snapshot, riskInPaused: true })
      .mockResolvedValue(snapshot);
    const sdk = { bank: { getSnapshot } };
    const { result } = renderHook(() => usePoolSnapshot({ sdk, poolId: 1 }));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("paused"));
    act(() => result.current.refresh());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
  it("does not interpret failed reads as an open pool", async () => {
    const getSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValue(new Error("RPC unavailable"));
    const sdk = { bank: { getSnapshot } };
    const { result } = renderHook(() => usePoolSnapshot({ sdk, poolId: 1 }));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    act(() => result.current.refresh());
    await waitFor(() => expect(getSnapshot).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });
  it("discards an old pool response arriving after an asset switch", async () => {
    let finishOld!: (value: typeof snapshot) => void;
    const getSnapshot = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockResolvedValue({ ...snapshot, riskInPaused: true });
    const sdk = { bank: { getSnapshot } };
    const { result, rerender } = renderHook(({ poolId }) => usePoolSnapshot({ sdk, poolId }), {
      initialProps: { poolId: 1 }
    });
    rerender({ poolId: 2 });
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("paused"));
    await act(async () => finishOld(snapshot));
    expect(result.current.status).toBe("paused");
  });
});

describe("per-player open bets", () => {
  const player = "0x0000000000000000000000000000000000000001" as const;
  it("reports the cap of two open bets per player and pool (ADR-0037 §5)", async () => {
    const getOpenHolds = vi
      .fn()
      .mockResolvedValueOnce({ open: 2n, max: 2n })
      .mockResolvedValue({ open: 1n, max: 2n });
    const sdk = { bank: { getOpenHolds } };
    const { result } = renderHook(() => usePlayerOpenHolds({ sdk, poolId: 1, account: player }));
    await waitFor(() => expect(result.current.atLimit).toBe(true));
    expect(getOpenHolds).toHaveBeenCalledWith(1, player);
    // A settlement frees a slot; the room refreshes right after it.
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.atLimit).toBe(false));
    expect(result.current.holds).toEqual({ open: 1n, max: 2n });
  });
  it("never blocks on a failed read: planning checks the cap again", async () => {
    const sdk = { bank: { getOpenHolds: vi.fn().mockRejectedValue(new Error("offline")) } };
    const { result } = renderHook(() => usePlayerOpenHolds({ sdk, poolId: 1, account: player }));
    await waitFor(() => expect(sdk.bank.getOpenHolds).toHaveBeenCalled());
    expect(result.current).toMatchObject({ holds: null, atLimit: false });
  });
  it("shows no count without a wallet or for another wallet's read", async () => {
    const getOpenHolds = vi.fn().mockResolvedValue({ open: 2n, max: 2n });
    const sdk = { bank: { getOpenHolds } };
    const { result, rerender } = renderHook(
      ({ account }: { account?: `0x${string}` }) => usePlayerOpenHolds({ sdk, poolId: 1, account }),
      { initialProps: { account: player as `0x${string}` | undefined } }
    );
    await waitFor(() => expect(result.current.atLimit).toBe(true));
    rerender({ account: undefined });
    expect(result.current).toMatchObject({ holds: null, atLimit: false });
  });
});
