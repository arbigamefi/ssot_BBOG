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

const plannedBet = {
  chainId: 84532,
  releaseDigest: "0xrelease",
  warnings: [],
  steps: [],
  payload: {},
  preview: { needsApproval: false }
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
    planNow: vi.fn(async () => plannedBet as any),
    betAmount: 10,
    betCount: 1,
    stopGain: 0,
    stopLoss: 0,
    diceTarget: 50,
    diceDirection: "under" as const,
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
      winChance: 1,
      messages: {
        rouletteSelectionRequired: "请选择至少一个轮盘投注项。"
      }
    });
    await executeGamePlaceBetAction(args);

    expect(mocks.toastError).toHaveBeenCalledWith("请选择至少一个轮盘投注项。");
    expect(args.planNow).not.toHaveBeenCalled();
  });

  it("plans a valid bet request", async () => {
    const affiliate = "0x6666666666666666666666666666666666666666";
    const args = baseArgs({ affiliate });
    await executeGamePlaceBetAction(args);

    expect(args.planNow).toHaveBeenCalledTimes(1);
    expect(args.executeNow).toHaveBeenCalledWith(plannedBet);
    expect((args.planNow as any).mock.calls[0]?.[0].stake).toBe(10_000_000n);
    expect((args.planNow as any).mock.calls[0]?.[0].affiliate).toBe(affiliate);
  });

  it("does not expose raw unexpected errors as player copy", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const args = baseArgs({
        planNow: vi.fn(async () => {
          throw new Error('The contract function "placeBet" reverted.');
        }),
        messages: {
          unexpectedError: "发生了非预期错误。"
        }
      });
      await executeGamePlaceBetAction(args);

      expect(mocks.toastError).toHaveBeenCalledWith("发生了非预期错误。");
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});
