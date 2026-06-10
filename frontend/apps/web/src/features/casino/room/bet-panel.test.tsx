import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GameRoomBetPanel,
  isPlaceBetButtonDisabled,
  type GameRoomBetPanelState
} from "./bet-panel";
import { derivePlaceBetButtonPhase } from "./place-bet-button";
import type { GameMeta } from "./model";

vi.mock("@ssot/ui", async () => {
  const actual = await vi.importActual<typeof import("@ssot/ui")>("@ssot/ui");
  return {
    ...actual,
    cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "casino.room.roundStatus.title": "Round status",
      "casino.room.roundStatus.phases.loadingQuote.label": "Estimating VRF fee",
      "casino.room.roundStatus.phases.loadingQuote.detail":
        "Reading the current randomness fee before you place a round.",
      "casino.room.roundStatus.phases.loadingQuote.status": "Estimating",
      "casino.room.roundStatus.phases.waitingVrf.label": "Waiting for draw",
      "casino.room.roundStatus.phases.waitingVrf.detail":
        "Your bet is on-chain. Waiting for verifiable randomness to open the result.",
      "casino.room.roundStatus.phases.waitingVrf.status": "Waiting for draw",
      "casino.room.roundStatus.phases.timeoutSoft.label": "Draw is taking longer than usual",
      "casino.room.roundStatus.phases.timeoutSoft.detail":
        "The round is still safe. Keep this page open while Chainlink fulfills the request.",
      "casino.room.roundStatus.phases.timeoutSoft.status": "Waiting",
      "casino.room.roundStatus.phases.placing.label": "Placing bet",
      "casino.room.roundStatus.phases.placing.detail":
        "Approve if needed, then sign PlaceBet. The round starts once the transaction is mined.",
      "casino.room.roundStatus.phases.placing.status": "Placing",
      "casino.room.roundStatus.phases.settling.label": "Settling result",
      "casino.room.roundStatus.phases.settling.detail":
        "Randomness is ready. Keeper settlement should complete automatically.",
      "casino.room.roundStatus.phases.settling.status": "Settling",
      "casino.room.roundStatus.phases.manualSettleOffered.label": "Keeper delay",
      "casino.room.roundStatus.phases.manualSettleOffered.detail":
        "Settlement is delayed. You can manually settle this result as a fallback.",
      "casino.room.roundStatus.phases.manualSettleOffered.status": "Manual settle offered",
      "casino.room.roundStatus.phases.settled.label": "Round settled",
      "casino.room.roundStatus.phases.settled.detail":
        "Settlement is confirmed on-chain. Preparing the final result proof.",
      "casino.room.roundStatus.phases.settled.status": "Settled",
      "casino.room.roundStatus.phases.refundable.label": "Refund path available",
      "casino.room.roundStatus.phases.refundable.detail":
        "VRF did not complete before the protocol timeout. You can refund the stake.",
      "casino.room.roundStatus.phases.refundable.status": "Refundable",
      "casino.room.roundStatus.phases.failed.label": "Round monitor failed",
      "casino.room.roundStatus.phases.failed.detail":
        "Unable to read the latest round state from the RPC provider.",
      "casino.room.roundStatus.phases.failed.status": "Failed",
      "casino.room.roundStatus.phases.ready.label": "Ready",
      "casino.room.roundStatus.phases.ready.detail":
        "One click will approve if needed, place the bet, and watch settlement.",
      "casino.room.roundStatus.phases.ready.status": "Ready",
      "casino.room.roundStatus.metrics.vrfEstimate": "VRF estimate",
      "casino.room.roundStatus.metrics.betId": "Bet ID",
      "casino.room.roundStatus.metrics.vrfRequest": "VRF request",
      "casino.room.roundStatus.actions.settleResult": "Settle result",
      "casino.room.roundStatus.actions.refundStake": "Refund stake",
      "casino.room.shell.noCapacity": "No capacity",
      "casino.room.betPanel.walletBalance": "Wallet Balance",
      "casino.room.betPanel.limits.maxBet": "Max bet",
      "casino.room.betPanel.limits.poolPayout": "Max payout",
      "casino.room.betPanel.syncing": "Syncing...",
      "casino.room.betPanel.notConnected": "Not connected",
      "casino.room.betPanel.walletGate.title": "Connect wallet to place a round",
      "casino.room.betPanel.walletGate.detail":
        "Pick the room settings now. The bet is signed only after your wallet is connected.",
      "casino.room.betPanel.amount.label": "Bet Amount",
      "casino.room.betPanel.amount.aria": "Bet amount",
      "casino.room.betPanel.amount.min": "Min",
      "casino.room.betPanel.amount.max": "Max",
      "casino.room.betPanel.rolls.label": "Rolls",
      "casino.room.betPanel.rolls.total": "Total: 10 USDC",
      "casino.room.betPanel.rolls.aria": "Roll count",
      "casino.room.betPanel.advanced.label": "Advanced",
      "casino.room.betPanel.advanced.stopGain": "Stop Gain (USDC)",
      "casino.room.betPanel.advanced.stopLoss": "Stop Loss (USDC)",
      "casino.room.betPanel.advanced.offPlaceholder": "0 = off",
      "casino.room.betPanel.advanced.help":
        "Optional auto-stop rules for multi-roll rounds. Set 0 to disable a rule.",
      "casino.room.betPanel.advanced.stopGainHelp": "Stops after total profit reaches this amount.",
      "casino.room.betPanel.advanced.stopLossHelp": "Stops after total loss reaches this amount.",
      "casino.room.betPanel.advanced.gainStop": "Gain stop at +0 USDC",
      "casino.room.betPanel.advanced.lossStop": "Loss stop at 0 USDC",
      "casino.room.betPanel.summary.multiplier": "Multiplier",
      "casino.room.betPanel.summary.winChance": "Win Chance",
      "casino.room.betPanel.summary.expectedPayout": "Expected Payout",
      "casino.room.betPanel.placeBet.connectWallet": "CONNECT WALLET",
      "casino.room.betPanel.placeBet.failedRetry": "TRANSACTION FAILED - RETRY",
      "casino.room.betPanel.placeBet.roundInProgress": "ROUND IN PROGRESS",
      "casino.room.betPanel.placeBet.betMined": "BET MINED...",
      "casino.room.betPanel.placeBet.signing": "SIGNING / PLACING...",
      "casino.room.betPanel.placeBet.reduceAmount": "REDUCE AMOUNT",
      "casino.room.betPanel.placeBet.selectToBet": "SELECT A BET",
      "casino.room.betPanel.placeBet.revealing": "REVEALING...",
      "casino.room.betPanel.placeBet.approveThenPlace": "APPROVE, THEN PLACE BET",
      "casino.room.betPanel.placeBet.preparing": "PREPARING ROUND...",
      "casino.room.betPanel.placeBet.placeBet": "PLACE BET",
      "casino.room.selection.plinko.riskProfile": "Risk Profile",
      "casino.room.selection.plinko.low": "Low",
      "casino.room.selection.plinko.medium": "Medium",
      "casino.room.selection.plinko.high": "High",
      "casino.room.selection.plinko.lowDetail": "Smoother board",
      "casino.room.selection.plinko.mediumDetail": "Balanced edge",
      "casino.room.selection.plinko.highDetail": "Extreme buckets",
      "casino.room.selection.baccarat.betOn": "Bet on",
      "casino.room.selection.baccarat.player": "Player",
      "casino.room.selection.baccarat.banker": "Banker",
      "casino.room.selection.baccarat.tie": "Tie",
      "casino.room.selection.sicBo.betType": "Bet type",
      "casino.room.selection.sicBo.face": "Face",
      "casino.room.selection.sicBo.total": "Total",
      "casino.room.selection.sicBo.kinds.small": "Small",
      "casino.room.selection.sicBo.kinds.big": "Big",
      "casino.room.selection.sicBo.kinds.anyTriple": "Any triple",
      "casino.room.selection.sicBo.kinds.specificTriple": "Specific triple",
      "casino.room.selection.sicBo.kinds.total": "Exact total",
      "casino.room.selection.sicBo.kinds.specificDouble": "Specific double",
      "casino.room.selection.sicBo.kinds.singleFace": "Single face"
    })[key] ?? key
}));

const diceGame: GameMeta = {
  gameId: "0x1111111111111111111111111111111111111111",
  slug: "dice",
  label: "Precision Dice",
  module: "0x2222222222222222222222222222222222222222"
};

const baseState: GameRoomBetPanelState = { status: "idle" };

function renderPanel(overrides: Partial<React.ComponentProps<typeof GameRoomBetPanel>> = {}) {
  const props: React.ComponentProps<typeof GameRoomBetPanel> = {
    game: diceGame,
    walletBalance: { label: "1,450.00 USDC", raw: 1_450_000_000n },
    assetDecimals: 6,
    assetSymbol: "USDC",
    maxBetLabel: "200 USDC",
    maxPayoutLabel: "500 USDC",
    betAmount: "10",
    onBetAmountChange: vi.fn(),
    betCount: 1,
    onBetCountChange: vi.fn(),
    stopGain: 0,
    onStopGainChange: vi.fn(),
    stopLoss: 0,
    onStopLossChange: vi.fn(),
    advancedOpen: false,
    onAdvancedOpenChange: vi.fn(),
    isPending: false,
    state: baseState,
    hasAccount: false,
    winChance: 50,
    multiplier: 1.98,
    expectedPayout: 19.8,
    roundPhase: "ready",
    manualSettleAvailable: false,
    onManualSettle: vi.fn(),
    manualRefundAvailable: false,
    onManualRefund: vi.fn(),
    onPlaceBet: vi.fn(),
    ...overrides
  };
  render(<GameRoomBetPanel {...props} />);
  return props;
}

describe("GameRoomBetPanel", () => {
  afterEach(() => cleanup());

  it("renders balance, core numbers, and disconnected CTA", () => {
    renderPanel();

    expect(screen.getByText("Wallet Balance")).toBeDefined();
    expect(screen.getByText("Max bet")).toBeDefined();
    expect(screen.getByText("200 USDC")).toBeDefined();
    expect(screen.getByText("Max payout")).toBeDefined();
    expect(screen.getByText("500 USDC")).toBeDefined();
    expect(screen.getByText("Not connected")).toBeDefined();
    expect(screen.getByText("Connect wallet to place a round")).toBeDefined();
    expect(screen.getByText("1.98x")).toBeDefined();
    expect(screen.getByText("50.00%")).toBeDefined();
    expect(screen.getByRole("button", { name: "CONNECT WALLET" })).toBeDefined();
  });

  it("shows the wallet balance only after an account is connected", () => {
    renderPanel({ hasAccount: true });

    expect(screen.getByText("Wallet Balance")).toBeDefined();
    expect(screen.getByText("1,450.00 USDC")).toBeDefined();
  });

  it("keeps compact round proof data in the panel while status lives on the CTA", () => {
    renderPanel({
      hasAccount: true,
      isPending: true,
      state: { status: "mined" },
      roundPhase: "waiting_vrf",
      vrfQuote: 7_410_000_000_0000n,
      activeBetId: 28n,
      activeRequestId:
        104964872007376604112859092387372891991342602865639700265695114041332312851084n
    });

    expect(screen.getByText("Round status")).toBeDefined();
    expect(screen.getByText("VRF estimate")).toBeDefined();
    expect(screen.getByText("0.0000741 ETH")).toBeDefined();
    expect(screen.getByText("Bet ID")).toBeDefined();
    expect(screen.getByText("28")).toBeDefined();
    expect(screen.getByText("VRF request")).toBeDefined();
    expect(screen.getByRole("button", { name: "Waiting for draw" })).toBeDefined();
  });

  it("routes amount shortcuts and place action through callbacks", () => {
    const props = renderPanel({ hasAccount: true });

    fireEvent.click(screen.getByRole("button", { name: "Min" }));
    expect(props.onBetAmountChange).toHaveBeenCalledWith("0.01");

    fireEvent.click(screen.getByRole("button", { name: "PLACE BET" }));
    expect(props.onPlaceBet).toHaveBeenCalledTimes(1);
  });

  it("caps the Max amount shortcut by wallet balance and current pool max bet", () => {
    const cappedByPool = renderPanel({
      hasAccount: true,
      maxBetRaw: 200_000_000n,
      onBetAmountChange: vi.fn()
    });
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(cappedByPool.onBetAmountChange).toHaveBeenCalledWith("200");

    cleanup();
    const cappedByWallet = renderPanel({
      hasAccount: true,
      walletBalance: { label: "100.00 USDC", raw: 100_000_000n },
      maxBetRaw: 200_000_000n,
      onBetAmountChange: vi.fn()
    });
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(cappedByWallet.onBetAmountChange).toHaveBeenCalledWith("100");
  });

  it("does not lift a zero wallet balance or tiny pool cap back to the minimum bet", () => {
    const zeroWallet = renderPanel({
      hasAccount: true,
      walletBalance: { label: "0 USDC", raw: 0n },
      maxBetRaw: 200_000_000n,
      onBetAmountChange: vi.fn()
    });

    expect(
      (screen.getByRole("button", { name: "No capacity" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect((screen.getByRole("textbox", { name: "Bet amount" }) as HTMLInputElement).disabled).toBe(
      true
    );
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(zeroWallet.onBetAmountChange).not.toHaveBeenCalled();

    cleanup();
    renderPanel({
      hasAccount: true,
      maxBetRaw: 9_000n
    });

    expect(
      (screen.getByRole("button", { name: "No capacity" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect((screen.getByRole("textbox", { name: "Bet amount" }) as HTMLInputElement).disabled).toBe(
      true
    );
  });

  it("disables placement when the typed amount exceeds the current effective max", () => {
    renderPanel({
      hasAccount: true,
      betAmount: "10",
      maxBetRaw: 5_000_000n
    });

    expect(
      (screen.getByRole("button", { name: "REDUCE AMOUNT" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("prompts for a selection before enabling non-dice rooms", () => {
    renderPanel({
      game: { ...diceGame, slug: "roulette", label: "Roulette" },
      hasAccount: true,
      winChance: 0
    });

    expect(
      (screen.getByRole("button", { name: "SELECT A BET" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("keeps active round status on the CTA even when the configured amount now exceeds max", () => {
    renderPanel({
      hasAccount: true,
      betAmount: "10",
      maxBetRaw: 5_000_000n,
      isPending: true,
      state: { status: "mined" },
      ctaPhase: "revealing"
    });

    expect(screen.getByRole("button", { name: "REVEALING..." })).toBeDefined();
    expect(screen.queryByRole("button", { name: "REDUCE AMOUNT" })).toBeNull();

    cleanup();
    renderPanel({
      hasAccount: true,
      betAmount: "10",
      maxBetRaw: 5_000_000n,
      isPending: true,
      state: { status: "mined" },
      ctaPhase: "settling"
    });

    expect(screen.getByRole("button", { name: "Settling" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "REDUCE AMOUNT" })).toBeNull();
  });

  it("locks amount shortcuts and advanced inputs while a round is active", () => {
    const props = renderPanel({
      hasAccount: true,
      isPending: true,
      advancedOpen: true,
      onBetAmountChange: vi.fn(),
      onAdvancedOpenChange: vi.fn(),
      onStopGainChange: vi.fn()
    });

    fireEvent.click(screen.getByRole("button", { name: "Min" }));
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Stop Gain (USDC)" }), {
      target: { value: "50" }
    });

    expect(props.onBetAmountChange).not.toHaveBeenCalled();
    expect(props.onAdvancedOpenChange).not.toHaveBeenCalled();
    expect(props.onStopGainChange).not.toHaveBeenCalled();
  });

  it("keeps failed placement actionable so users can clear stale max-bet failures", () => {
    const props = renderPanel({
      hasAccount: true,
      isPending: true,
      state: { status: "failed", error: { message: "reverted" } },
      betAmount: "10",
      maxBetRaw: 5_000_000n,
      onBetAmountChange: vi.fn()
    });

    const button = screen.getByRole("button", {
      name: "TRANSACTION FAILED - RETRY"
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Min" }));
    expect(props.onBetAmountChange).toHaveBeenCalledWith("0.01");

    fireEvent.click(button);
    expect(props.onPlaceBet).toHaveBeenCalledTimes(1);
  });

  it("renders deterministic CTA labels and exposes disabled helpers", () => {
    cleanup();
    renderPanel({
      hasAccount: true,
      state: { status: "idle", plan: { preview: { needsApproval: true } } }
    });

    expect(screen.getByRole("button", { name: "APPROVE, THEN PLACE BET" })).toBeDefined();
    expect(
      isPlaceBetButtonDisabled({
        gameSlug: "roulette",
        isPending: false,
        winChance: 0,
        state: baseState
      })
    ).toBe(true);
    expect(
      isPlaceBetButtonDisabled({
        gameSlug: "dice",
        isPending: false,
        winChance: 50,
        state: baseState,
        amountExceedsMax: true
      })
    ).toBe(true);
    expect(
      isPlaceBetButtonDisabled({
        gameSlug: "dice",
        isPending: true,
        winChance: 50,
        state: baseState,
        amountUnavailable: true,
        manualSettleAvailable: true
      })
    ).toBe(false);
    expect(
      isPlaceBetButtonDisabled({
        gameSlug: "dice",
        isPending: true,
        winChance: 50,
        state: { status: "failed" },
        amountExceedsMax: true
      })
    ).toBe(false);
  });

  it("uses one signing label for wallet submission and a separate reveal label", () => {
    renderPanel({
      hasAccount: true,
      isPending: true,
      state: { status: "submitting", plan: { preview: { needsApproval: true } } }
    });
    expect(screen.getByRole("button", { name: "SIGNING / PLACING..." })).toBeDefined();

    cleanup();
    renderPanel({
      hasAccount: true,
      isPending: true,
      state: { status: "submitting", plan: { preview: { needsApproval: false } } }
    });
    expect(screen.getByRole("button", { name: "SIGNING / PLACING..." })).toBeDefined();

    cleanup();
    renderPanel({
      hasAccount: true,
      isPending: true,
      state: { status: "mined" },
      ctaPhase: "revealing"
    });
    expect(screen.getByRole("button", { name: "REVEALING..." })).toBeDefined();
  });

  it("keeps the CTA in reveal state as soon as randomness is ready", () => {
    expect(
      derivePlaceBetButtonPhase({
        roundPhase: "settling",
        activeBetState: "randomReady",
        activeBetId: 42n,
        stageReveal: null,
        revealedBetId: null
      })
    ).toBe("revealing");

    expect(
      derivePlaceBetButtonPhase({
        roundPhase: "settling",
        activeBetState: "randomReady",
        activeBetId: 42n,
        stageReveal: { betId: 42n, phase: "revealed" },
        revealedBetId: 42n
      })
    ).toBe("settling");
  });

  it("uses text inputs for casino amounts and sanitizes amount changes", () => {
    const props = renderPanel({
      advancedOpen: true,
      onBetAmountChange: vi.fn(),
      onBetCountChange: vi.fn(),
      onStopGainChange: vi.fn(),
      onStopLossChange: vi.fn()
    });

    expect(screen.queryByRole("spinbutton")).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Bet amount" }), {
      target: { value: "abc25.5" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Roll count" }), {
      target: { value: "120" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Stop Gain (USDC)" }), {
      target: { value: "30x" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Stop Loss (USDC)" }), {
      target: { value: "" }
    });

    expect(props.onBetAmountChange).toHaveBeenCalledWith("25.5");
    expect(props.onBetCountChange).toHaveBeenCalledWith(100);
    expect(props.onStopGainChange).toHaveBeenCalledWith(30);
    expect(props.onStopLossChange).toHaveBeenCalledWith(0);
  });

  it("routes manual settlement through the primary button", () => {
    const onManualSettle = vi.fn();
    renderPanel({
      hasAccount: true,
      isPending: true,
      roundPhase: "manual_settle_offered",
      manualSettleAvailable: true,
      onManualSettle
    });

    fireEvent.click(screen.getByRole("button", { name: "Settle result" }));

    expect(onManualSettle).toHaveBeenCalledTimes(1);
  });

  it("routes refund fallback through the primary button", () => {
    const onManualRefund = vi.fn();
    renderPanel({
      hasAccount: true,
      roundPhase: "refundable",
      manualRefundAvailable: true,
      onManualRefund
    });

    fireEvent.click(screen.getByRole("button", { name: "Refund stake" }));

    expect(onManualRefund).toHaveBeenCalledTimes(1);
  });
});
