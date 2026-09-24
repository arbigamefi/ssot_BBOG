import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameMeta } from "./model";
import { useCasinoRound, type UseCasinoRoundArgs } from "./use-casino-round";

const mocks = vi.hoisted(() => ({ planNow: vi.fn(), executeNow: vi.fn(), reset: vi.fn() }));
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
  useCasinoVrfQuote: () => ({ phase: "ready" }),
  useCasinoRoundWatcher: () => ({ phase: "idle" })
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
  beforeEach(() => vi.clearAllMocks());
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
