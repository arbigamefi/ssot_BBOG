import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GameRoomBetPanel,
  isPlaceBetButtonDisabled,
  type GameRoomBetPanelState
} from "./bet-panel";
import { parseWalletBalanceAmount } from "./bet-panel-sections";
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
      "casino.room.roundStatus.phases.waitingVrf.label": "Rolling",
      "casino.room.roundStatus.phases.waitingVrf.detail":
        "PlaceBet is mined. Waiting for verifiable randomness.",
      "casino.room.roundStatus.phases.waitingVrf.status": "Waiting VRF",
      "casino.room.roundStatus.phases.timeoutSoft.label": "VRF is taking longer than usual",
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
      "casino.room.betPanel.walletBalance": "Wallet Balance",
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
    walletBalance: "1,450.00 USDC",
    isSynced: true,
    betAmount: 10,
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
    vrfQuote: 73_169_600_001_705n,
    vrfQuoteError: undefined,
    activeBetId: undefined,
    activeRequestId: undefined,
    roundError: undefined,
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
    expect(screen.getByText("Not connected")).toBeDefined();
    expect(screen.getByText("Connect wallet to place a round")).toBeDefined();
    expect(
      screen.getByText(
        "Pick the room settings now. The bet is signed only after your wallet is connected."
      )
    ).toBeDefined();
    expect(screen.getByText("VRF estimate")).toBeDefined();
    expect(screen.getByText("1.98x")).toBeDefined();
    expect(screen.getByText("50.00%")).toBeDefined();
    expect(screen.getByRole("button", { name: "CONNECT WALLET" })).toBeDefined();
  });

  it("shows the wallet balance only after an account is connected", () => {
    renderPanel({ hasAccount: true });

    expect(screen.getByText("Wallet Balance")).toBeDefined();
    expect(screen.getByText("1,450.00 USDC")).toBeDefined();
  });

  it("routes amount shortcuts and place action through callbacks", () => {
    const props = renderPanel({ hasAccount: true });

    fireEvent.click(screen.getByRole("button", { name: "Min" }));
    expect(props.onBetAmountChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "PLACE BET" }));
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
  });

  it("parses wallet balances for max amount shortcuts", () => {
    expect(parseWalletBalanceAmount("1,450.00 USDC")).toBe(1450);
    expect(parseWalletBalanceAmount(null)).toBe(1450);
  });

  it("uses text inputs for casino amounts and sanitizes whole-unit changes", () => {
    const props = renderPanel({
      advancedOpen: true,
      onBetAmountChange: vi.fn(),
      onBetCountChange: vi.fn(),
      onStopGainChange: vi.fn(),
      onStopLossChange: vi.fn()
    });

    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(
      screen.getByText("Optional auto-stop rules for multi-roll rounds. Set 0 to disable a rule.")
    ).toBeDefined();
    expect(screen.getByText("Stops after total profit reaches this amount.")).toBeDefined();
    expect(screen.getByText("Stops after total loss reaches this amount.")).toBeDefined();

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

    expect(props.onBetAmountChange).toHaveBeenCalledWith(25);
    expect(props.onBetCountChange).toHaveBeenCalledWith(100);
    expect(props.onStopGainChange).toHaveBeenCalledWith(30);
    expect(props.onStopLossChange).toHaveBeenCalledWith(0);
  });

  it("shows explicit manual settlement and refund fallback controls only when provided", () => {
    const onManualSettle = vi.fn();
    const onManualRefund = vi.fn();
    renderPanel({
      hasAccount: true,
      roundPhase: "refundable",
      manualSettleAvailable: true,
      onManualSettle,
      manualRefundAvailable: true,
      onManualRefund
    });

    fireEvent.click(screen.getByRole("button", { name: "Settle result" }));
    fireEvent.click(screen.getByRole("button", { name: "Refund stake" }));

    expect(onManualSettle).toHaveBeenCalledTimes(1);
    expect(onManualRefund).toHaveBeenCalledTimes(1);
  });
});
