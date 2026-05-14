import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameMeta } from "./model";
import {
  executeGamePlaceBetAction,
  shouldBlockGamePlaceBet,
  shouldResetGamePlaceBet
} from "./place-bet-action";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn()
}));

vi.mock("@ssot/ui", () => ({
  toast: {
    error: mocks.toastError
  }
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
  ]
};

function baseArgs(overrides: Partial<Parameters<typeof executeGamePlaceBetAction>[0]> = {}) {
  return {
    account: "0x4444444444444444444444444444444444444444",
    openConnectModal: vi.fn(),
    release,
    game,
    winChance: 50,
    state: { status: "idle" },
    reset: vi.fn(),
    setShowResult: vi.fn(),
    executeNow: vi.fn(async () => undefined),
    planNow: vi.fn(async () => undefined),
    betAmount: 10,
    betCount: 1,
    stopGain: 0,
    stopLoss: 0,
    diceTarget: 50,
    coinSide: "HEADS" as const,
    rouletteSpots: [],
    kenoSpots: [],
    ...overrides
  };
}

describe("game room place bet action", () => {
  beforeEach(() => {
    mocks.toastError.mockClear();
  });

  it("exposes small branch helpers", () => {
    expect(shouldBlockGamePlaceBet("roulette", 0)).toBe(true);
    expect(shouldBlockGamePlaceBet("dice", 0)).toBe(false);
    expect(shouldResetGamePlaceBet("failed")).toBe(true);
    expect(shouldResetGamePlaceBet("ready")).toBe(false);
  });

  it("opens wallet connect when there is no account", async () => {
    const args = baseArgs({ account: undefined });
    await executeGamePlaceBetAction(args);

    expect(args.openConnectModal).toHaveBeenCalledTimes(1);
    expect(args.planNow).not.toHaveBeenCalled();
  });

  it("resets after a terminal stepper state", async () => {
    const args = baseArgs({ state: { status: "failed" } });
    await executeGamePlaceBetAction(args);

    expect(args.reset).toHaveBeenCalledTimes(1);
    expect(args.setShowResult).toHaveBeenCalledWith(false);
  });

  it("executes an existing plan before planning a new one", async () => {
    const args = baseArgs({ state: { status: "ready", plan: { preview: {} } } });
    await executeGamePlaceBetAction(args);

    expect(args.executeNow).toHaveBeenCalledTimes(1);
    expect(args.planNow).not.toHaveBeenCalled();
  });

  it("surfaces game parameter validation errors", async () => {
    const args = baseArgs({
      game: { ...game, slug: "roulette", label: "Roulette" },
      rouletteSpots: [],
      winChance: 1
    });
    await executeGamePlaceBetAction(args);

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please select at least one number or bet type on the Roulette board."
    );
    expect(args.planNow).not.toHaveBeenCalled();
  });

  it("plans a valid bet request", async () => {
    const args = baseArgs();
    await executeGamePlaceBetAction(args);

    expect(args.planNow).toHaveBeenCalledTimes(1);
    expect((args.planNow as any).mock.calls[0]?.[0].stake).toBe(10_000_000n);
  });
});
