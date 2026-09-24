import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaceBetPlan } from "@ssot/ssot";
import { usePlaceBetStepper } from "./usePlaceBetStepper";

const mocks = vi.hoisted(() => ({
  planPlaceBet: vi.fn(),
  executePlan: vi.fn(),
  reconcilePlaceBetTx: vi.fn()
}));
vi.mock("../../ssot/sdk", () => ({ useSSOTSDK: () => ({ sdk: { gameHub: mocks } }) }));
const txHash = `0x${"ab".repeat(32)}` as const;
const plan = { chainId: 84532, preview: { needsApproval: false } } as PlaceBetPlan;

describe("submission recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  it("queries a retained transaction after timeout without submitting a second bet", async () => {
    mocks.planPlaceBet.mockResolvedValue(plan);
    mocks.executePlan.mockResolvedValue({
      placeBetTx: {
        ok: false,
        txHash,
        error: {
          code: "TX_TIMEOUT",
          message: "timeout",
          details: { chainId: 84532, action: "PLACE_BET", txHash }
        }
      }
    });
    mocks.reconcilePlaceBetTx
      .mockRejectedValueOnce(new Error("still offline"))
      .mockResolvedValueOnce({ ok: true, betId: 42n });
    const { result } = renderHook(() => usePlaceBetStepper());
    await act(async () => {
      await result.current.planNow({} as any);
    });
    await act(async () => {
      await result.current.executeNow(plan);
    });
    expect(result.current.state.result?.placeBetTx.txHash).toBe(txHash);
    await act(async () => {
      await result.current.reconcileNow();
    });
    expect(result.current.state.error).toMatchObject({
      code: "TX_STATUS_UNKNOWN",
      details: { chainId: 84532, txHash }
    });
    await act(async () => {
      await result.current.reconcileNow();
    });
    expect(result.current.state).toMatchObject({ status: "reconciled", betId: 42n });
    expect(mocks.executePlan).toHaveBeenCalledOnce();
    expect(mocks.reconcilePlaceBetTx).toHaveBeenCalledWith(txHash);
  });
  it("makes a confirmed reverted transaction recoverable while retaining its hash", async () => {
    mocks.executePlan.mockResolvedValue({
      placeBetTx: { ok: false, txHash, error: { code: "TX_TIMEOUT" } }
    });
    mocks.reconcilePlaceBetTx.mockResolvedValue({
      ok: false,
      error: { code: "TX_REVERTED", details: { chainId: 84532, txHash } }
    });
    const { result } = renderHook(() => usePlaceBetStepper());
    await act(async () => {
      await result.current.executeNow(plan);
    });
    await act(async () => {
      await result.current.reconcileNow();
    });
    expect(result.current.state).toMatchObject({
      status: "failed",
      error: { code: "TX_REVERTED", details: { txHash } }
    });
    expect(mocks.executePlan).toHaveBeenCalledOnce();
  });
});
