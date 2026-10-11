import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameMeta } from "./model";
import { useCasinoRound, type UseCasinoRoundArgs } from "./use-casino-round";

const mocks = vi.hoisted(() => ({
  planNow: vi.fn(),
  executeNow: vi.fn(),
  reset: vi.fn(),
  houseEdgeBps: 200,
  quoteFailed: false,
  unbookedBetId: undefined as bigint | undefined,
  unbookedState: "placed" as "placed" | "randomReady",
  recovery: vi.fn()
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@ssot/ui", () => ({ toast: { error: vi.fn() } }));
vi.mock("../../betting/usePlaceBetStepper", () => ({
  usePlaceBetStepper: () => ({ ...mocks, state: { status: "idle" } })
}));
vi.mock("./feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./feedback")>()),
  useBetStepperFailureToast: vi.fn(),
  useVrfTimeoutToast: vi.fn()
}));
vi.mock("./casino-round", () => ({
  useCasinoVrfQuote: () => ({
    phase: "ready",
    quote: 1n,
    config: mocks.quoteFailed
      ? undefined
      : { maxBetCount: 25, houseEdgeBps: mocks.houseEdgeBps, callbackGasLimit: 2_000_000 },
    quoteError: mocks.quoteFailed ? "RPC failed" : undefined,
    refresh: vi.fn()
  }),
  useCasinoRoundWatcher: () =>
    mocks.unbookedBetId !== undefined
      ? {
          phase: "result_unbooked",
          bet: { betId: mocks.unbookedBetId, state: mocks.unbookedState, houseEdgeBps: 200 },
          manualRefundAvailable: false,
          manualSettleAvailable: false,
          isLive: false
        }
      : mocks.quoteFailed
        ? {
            phase: "refundable",
            bet: { betId: 7n, state: "pendingVrf", houseEdgeBps: 200 },
            manualRefundAvailable: true,
            manualRefund: mocks.recovery
          }
        : { phase: "idle" }
}));
const game: GameMeta = {
  gameId: "0x1111111111111111111111111111111111111111",
  slug: "dice",
  label: "Dice",
  module: "0x2222222222222222222222222222222222222222"
};

const release = {
  chainId: 84532,
  assets: [
    {
      symbol: "USDC",
      address: "0x3333333333333333333333333333333333333333",
      decimals: 6
    }
  ],
  pools: [
    {
      poolId: 1,
      domain: "Casino",
      domainId: 1,
      active: true,
      asset: "0x3333333333333333333333333333333333333333",
      bank: "0x5555555555555555555555555555555555555555",
      symbol: "USDC",
      decimals: 6
    }
  ]
};

const props: UseCasinoRoundArgs = {
  sdk: { account: "0x4444444444444444444444444444444444444444" } as any,
  release,
  game,
  winChance: 50,
  openConnectModal: vi.fn(),
  betAmount: "10",
  betCount: 1,
  stopGain: 0,
  stopLoss: 0,
  diceTarget: 50,
  diceDirection: "under",
  coinSide: "HEADS",
  rouletteSpots: [],
  kenoSpots: [],
  plinkoRisk: "medium",
  baccaratSide: "player",
  sicBoKind: "small",
  sicBoValue: 1,
  onRoundStart: vi.fn(),
  onRoundTerminal: vi.fn(),
  onRoundReset: vi.fn(),
  poolAvailability: "ready"
};

describe("casino submission intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.houseEdgeBps = 200;
    mocks.quoteFailed = false;
    mocks.unbookedBetId = undefined;
    mocks.unbookedState = "placed";
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("preserves an existing PendingVRF refund while a fresh fee read fails", async () => {
    mocks.quoteFailed = true;
    const { result } = renderHook(() => useCasinoRound(props));
    expect(result.current.houseEdgeBps).toBeUndefined();
    expect(result.current.availability).toBe("gameUnavailable");
    expect(result.current.activeBet).toMatchObject({ betId: 7n, houseEdgeBps: 200 });
    expect(result.current.manualRefundAvailable).toBe(true);
    result.current.manualRefund?.();
    expect(mocks.recovery).toHaveBeenCalledOnce();
    await act(async () => {
      await result.current.placeBet();
    });
    expect(mocks.planNow).not.toHaveBeenCalled();
  });
  it.each(["placed", "randomReady"] as const)(
    "hands an unbookable %s bet to a notice and frees the room for new bets",
    (betState) => {
      mocks.unbookedBetId = 7n;
      mocks.unbookedState = betState;
      const { result, rerender } = renderHook(() => useCasinoRound(props));

      expect(result.current.pendingSettlementBetIds).toEqual([7n]);
      expect(mocks.reset).toHaveBeenCalledOnce();
      // A revealed RandomReady outcome must not stay on the stage or keep the panel locked.
      expect(props.onRoundReset).toHaveBeenCalledOnce();
      expect(result.current.manualRefundAvailable).toBe(false);
      rerender();
      expect(result.current.pendingSettlementBetIds).toEqual([7n]);
      expect(mocks.reset).toHaveBeenCalledOnce();
    }
  );
  it("blocks two immediate clicks before React can render a pending state", async () => {
    let finish!: (plan: any) => void;
    mocks.planNow.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result } = renderHook(() => useCasinoRound(props));
    let first!: Promise<void>;
    act(() => {
      first = result.current.placeBet();
      void result.current.placeBet();
    });
    expect(mocks.planNow).toHaveBeenCalledOnce();
    await act(async () => {
      finish({ preview: {} });
      await first;
    });
    expect(mocks.executeNow).toHaveBeenCalledOnce();
  });
  it("invalidates a pending intent when governance changes the displayed fee, then signs the refreshed fee", async () => {
    let finish!: (plan: any) => void;
    mocks.planNow.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result, rerender } = renderHook(() => useCasinoRound(props));
    let first!: Promise<void>;
    act(() => {
      first = result.current.placeBet();
    });
    expect(mocks.planNow).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxHouseEdgeBps: 200 })
    );
    mocks.houseEdgeBps = 300;
    rerender();
    await act(async () => {
      finish({ preview: {} });
      await first;
    });
    expect(mocks.executeNow).not.toHaveBeenCalled();
    mocks.planNow.mockResolvedValueOnce({ preview: {} });
    await act(async () => {
      await result.current.placeBet();
    });
    expect(mocks.planNow).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxHouseEdgeBps: 300 })
    );
    expect(mocks.executeNow).toHaveBeenCalledOnce();
  });
  it("discards an in-flight quote after the user changes the amount", async () => {
    let finish!: (plan: any) => void;
    mocks.planNow.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result, rerender } = renderHook((args) => useCasinoRound(args), {
      initialProps: props
    });
    let first!: Promise<void>;
    act(() => {
      first = result.current.placeBet();
    });
    rerender({ ...props, betAmount: "20" });
    await act(async () => {
      finish({ preview: {} });
      await first;
    });
    expect(mocks.executeNow).not.toHaveBeenCalled();
    expect(mocks.reset).toHaveBeenCalledOnce();
  });
  it("does not request a signature after the player leaves the room", async () => {
    let finish!: (plan: any) => void;
    mocks.planNow.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result, unmount } = renderHook(() => useCasinoRound(props));
    let first!: Promise<void>;
    act(() => {
      first = result.current.placeBet();
    });
    unmount();
    await act(async () => {
      finish({ preview: {} });
      await first;
    });
    expect(mocks.executeNow).not.toHaveBeenCalled();
  });
});
