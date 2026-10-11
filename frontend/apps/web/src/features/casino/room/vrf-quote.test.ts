import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SSOTSDK } from "@ssot/ssot/sdk";
import { useCasinoVrfQuote } from "./casino-round";
const gameId = "0x11" as const;
const config = {
  gameId,
  module: "0x2222222222222222222222222222222222222222",
  maxBetCount: 25,
  houseEdgeBps: 200,
  callbackGasLimit: 2447746
};
function setup() {
  const getGameConfig = vi.fn().mockResolvedValue(config);
  const quoteVRFFee = vi.fn().mockResolvedValue(123n);
  return {
    getGameConfig,
    quoteVRFFee,
    sdk: { gameHub: { getGameConfig, quoteVRFFee } } as unknown as SSOTSDK
  };
}
afterEach(cleanup);
describe("game-aware VRF quote", () => {
  it("reads admission and quotes the selected game and count", async () => {
    const { sdk, getGameConfig, quoteVRFFee } = setup();
    const { result } = renderHook(() => useCasinoVrfQuote({ sdk, gameId, betCount: 20 }));
    expect(result.current.phase).toBe("loading_quote");
    await waitFor(() => expect(result.current.quote).toBe(123n));
    expect(getGameConfig).toHaveBeenCalledWith(gameId);
    expect(quoteVRFFee).toHaveBeenCalledWith(gameId, 20);
    expect(result.current.config?.maxBetCount).toBe(25);
  });
  it("retains the actual smaller limit but never quotes an excess round count", async () => {
    const { sdk, quoteVRFFee } = setup();
    const { result } = renderHook(() =>
      useCasinoVrfQuote({ sdk, gameId, betCount: 26, quoteErrorMessage: "unavailable" })
    );
    await waitFor(() => expect(result.current.quoteError).toBe("unavailable"));
    expect(result.current.config?.maxBetCount).toBe(25);
    expect(quoteVRFFee).not.toHaveBeenCalled();
  });
  it("drops a stale quote immediately when the game changes and ignores a late response", async () => {
    const { sdk, getGameConfig, quoteVRFFee } = setup();
    let finish!: (value: bigint) => void;
    quoteVRFFee
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValue(456n);
    const { result, rerender } = renderHook(
      ({ id }) => useCasinoVrfQuote({ sdk, gameId: id, betCount: 1 }),
      { initialProps: { id: gameId as `0x${string}` } }
    );
    await waitFor(() => expect(quoteVRFFee).toHaveBeenCalledTimes(1));
    getGameConfig.mockResolvedValue({ ...config, gameId: "0x22" });
    rerender({ id: "0x22" });
    expect(result.current.quote).toBeUndefined();
    await waitFor(() => expect(result.current.quote).toBe(456n));
    await act(async () => finish(123n));
    expect(result.current.quote).toBe(456n);
  });
  it("refreshes the fee and game admission together after a governance change", async () => {
    const { sdk, getGameConfig } = setup();
    const { result } = renderHook(() => useCasinoVrfQuote({ sdk, gameId, betCount: 1 }));
    await waitFor(() => expect(result.current.config?.houseEdgeBps).toBe(200));
    getGameConfig.mockResolvedValue({ ...config, houseEdgeBps: 300 });
    act(() => result.current.refresh());
    expect(result.current.config).toBeUndefined();
    await waitFor(() => expect(result.current.config?.houseEdgeBps).toBe(300));
  });
  it("clears admission after a failed refresh instead of retaining an apparently healthy quote", async () => {
    const { sdk, getGameConfig } = setup();
    const { result } = renderHook(() =>
      useCasinoVrfQuote({ sdk, gameId, betCount: 1, quoteErrorMessage: "offline" })
    );
    await waitFor(() => expect(result.current.quote).toBe(123n));
    getGameConfig.mockRejectedValue(new Error("RPC"));
    act(() => result.current.refresh());
    expect(result.current.quote).toBeUndefined();
    await waitFor(() => expect(result.current.quoteError).toBe("offline"));
    expect(result.current.config).toBeUndefined();
  });
  it("never quotes a disabled game and reports it closed (ADR-0037 §6)", async () => {
    const { sdk, getGameConfig, quoteVRFFee } = setup();
    getGameConfig.mockResolvedValue({ ...config, disabled: true });
    const { result } = renderHook(() => useCasinoVrfQuote({ sdk, gameId, betCount: 1 }));
    await waitFor(() => expect(result.current.config?.disabled).toBe(true));
    expect(quoteVRFFee).not.toHaveBeenCalled();
    expect(result.current.quote).toBeUndefined();
  });
});
