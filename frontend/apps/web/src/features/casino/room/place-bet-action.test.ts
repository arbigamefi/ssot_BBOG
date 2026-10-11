import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameMeta } from "./model";
import {
  executeGamePlaceBetAction,
  isCasinoRiskInEnabledForChain,
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
      asset: "0x3333333333333333333333333333333333333333",
      bank: "0x5555555555555555555555555555555555555555",
      symbol: "USDC",
      decimals: 6
    }
  ]
};

const mainnetRelease = {
  ...release,
  chainId: 8453
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
    onBeforeExecute: vi.fn(),
    betAmount: "10",
    betCount: 1,
    maxHouseEdgeBps: 200,
    stopGain: 0,
    stopLoss: 0,
    diceTarget: 50,
    diceDirection: "under" as const,
    coinSide: "HEADS" as const,
    rouletteSpots: [],
    kenoSpots: [],
    plinkoRisk: "medium" as const,
    ...overrides
  };
}

describe("game room place bet action", () => {
  beforeEach(() => {
    mocks.toastError.mockClear();
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes small branch helpers", () => {
    expect(shouldBlockGamePlaceBet("roulette", 0)).toBe(true);
    expect(shouldBlockGamePlaceBet("dice", 0)).toBe(false);
    expect(shouldResetGamePlaceBet("failed")).toBe(true);
    expect(shouldResetGamePlaceBet("ready")).toBe(false);
    expect(isCasinoRiskInEnabledForChain(84532)).toBe(true);
    expect(isCasinoRiskInEnabledForChain(8453)).toBe(true);
  });

  it("blocks unavailable mainnet before opening a wallet or executing a cached plan", async () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "false");
    for (const account of [undefined, "0x4444444444444444444444444444444444444444"]) {
      const args = baseArgs({
        account,
        release: mainnetRelease,
        state: { status: "ready", plan: plannedBet }
      });
      await executeGamePlaceBetAction(args);
      expect(args.openConnectModal).not.toHaveBeenCalled();
      expect(args.executeNow).not.toHaveBeenCalled();
      expect(args.planNow).not.toHaveBeenCalled();
    }
    expect(isCasinoRiskInEnabledForChain(999999)).toBe(false);
  });

  it("opens wallet connect when there is no account", async () => {
    const args = baseArgs({ account: undefined });
    await executeGamePlaceBetAction(args);

    expect(args.openConnectModal).toHaveBeenCalledTimes(1);
    expect(args.planNow).not.toHaveBeenCalled();
    expect(args.onBeforeExecute).not.toHaveBeenCalled();
  });

  it("replans after a failed attempt on the same click", async () => {
    const args = baseArgs({ state: { status: "failed" } });
    await executeGamePlaceBetAction(args);
    expect(args.reset).toHaveBeenCalledOnce();
    expect(args.planNow).toHaveBeenCalledOnce();
    expect(args.executeNow).toHaveBeenCalledWith(plannedBet);
  });
  it("replaces a cached plan with a fresh plan from current inputs", async () => {
    const args = baseArgs({ state: { status: "ready", plan: { stale: true } }, betAmount: "0.25" });
    await executeGamePlaceBetAction(args);
    expect(args.planNow).toHaveBeenCalledOnce();
    expect(args.planNow).toHaveBeenCalledWith(expect.objectContaining({ stake: 250000n }));
    expect(args.executeNow).toHaveBeenCalledWith(plannedBet);
  });
  it.each(["loading", "unavailable", "paused"] as const)(
    "blocks %s pools before connecting or using cached plans",
    async (poolAvailability) => {
      const args = baseArgs({
        account: undefined,
        poolAvailability,
        state: { status: "ready", plan: plannedBet }
      });
      await executeGamePlaceBetAction(args);
      expect(args.openConnectModal).not.toHaveBeenCalled();
      expect(args.executeNow).not.toHaveBeenCalled();
      expect(args.planNow).not.toHaveBeenCalled();
    }
  );
  it("never turns an unconfirmed transaction into a new bet", async () => {
    const args = baseArgs({ state: { status: "failed", error: { code: "TX_TIMEOUT" } } });
    await executeGamePlaceBetAction(args);
    expect(args.reset).not.toHaveBeenCalled();
    expect(args.planNow).not.toHaveBeenCalled();
    expect(args.executeNow).not.toHaveBeenCalled();
  });
  it("discards a quote if the wallet or intent changed while planning", async () => {
    const args = baseArgs({ isCurrent: () => false });
    await executeGamePlaceBetAction(args);
    expect(args.planNow).toHaveBeenCalledOnce();
    expect(args.executeNow).not.toHaveBeenCalled();
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
    expect(args.onBeforeExecute).not.toHaveBeenCalled();
  });

  it("plans a valid bet request", async () => {
    const affiliate = "0x6666666666666666666666666666666666666666";
    const args = baseArgs({ affiliate });
    await executeGamePlaceBetAction(args);

    expect(args.planNow).toHaveBeenCalledTimes(1);
    expect(args.onBeforeExecute).toHaveBeenCalledTimes(1);
    expect(args.executeNow).toHaveBeenCalledWith(plannedBet);
    expect((args.onBeforeExecute as any).mock.invocationCallOrder[0]).toBeLessThan(
      (args.executeNow as any).mock.invocationCallOrder[0]
    );
    expect((args.planNow as any).mock.calls[0]?.[0].stake).toBe(10_000_000n);
    expect((args.planNow as any).mock.calls[0]?.[0].affiliate).toBe(affiliate);
  });

  it("blocks Base mainnet betting until casino risk-in is explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "false");
    const args = baseArgs({
      release: mainnetRelease,
      messages: {
        mainnetRiskInDisabled: "主网下注关闭。"
      }
    });
    await executeGamePlaceBetAction(args);

    expect(mocks.toastError).toHaveBeenCalledWith("主网下注关闭。");
    expect(args.planNow).not.toHaveBeenCalled();
    expect(args.onBeforeExecute).not.toHaveBeenCalled();
  });

  it("allows Base mainnet betting when casino risk-in is explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    const args = baseArgs({
      release: mainnetRelease
    });
    await executeGamePlaceBetAction(args);

    expect(args.planNow).toHaveBeenCalledTimes(1);
    expect(args.executeNow).toHaveBeenCalledWith(plannedBet);
  });

  it("signs precisely the displayed live fee ceiling", async () => {
    const args = baseArgs({ maxHouseEdgeBps: 200 });
    await executeGamePlaceBetAction(args);
    expect(args.planNow).toHaveBeenCalledWith(expect.objectContaining({ maxHouseEdgeBps: 200 }));
  });
  it.each([undefined, 0, 501, NaN])(
    "does not plan or sign without a valid read fee (%s)",
    async (maxHouseEdgeBps) => {
      const args = baseArgs({
        maxHouseEdgeBps,
        messages: { houseEdgeUnavailable: "Refresh current fee" }
      });
      await executeGamePlaceBetAction(args);
      expect(mocks.toastError).toHaveBeenCalledWith("Refresh current fee");
      expect(args.planNow).not.toHaveBeenCalled();
      expect(args.executeNow).not.toHaveBeenCalled();
    }
  );
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
      expect(args.onBeforeExecute).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
