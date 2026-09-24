import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  formatTokenBalance,
  pickKenoStrobeSpots,
  useGameWalletBalance,
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
  const snapshot = { totalAssets: 100n, totalReserved: 0n, riskInPaused: false };
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
  it("does not interpret failed or incomplete reads as an open pool", async () => {
    const getSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ totalAssets: 100n, totalReserved: 0n });
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
