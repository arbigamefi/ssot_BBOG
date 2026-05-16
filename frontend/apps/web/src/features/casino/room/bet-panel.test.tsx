import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GameRoomBetPanel,
  getPlaceBetButtonLabel,
  isPlaceBetButtonDisabled,
  type GameRoomBetPanelState
} from "./bet-panel";
import { parseWalletBalanceAmount } from "./bet-amount-section";
import type { GameMeta } from "./model";

vi.mock("@ssot/ui", async () => {
  const actual = await vi.importActual<typeof import("@ssot/ui")>("@ssot/ui");
  return {
    ...actual,
    cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
  };
});

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
    coinSide: "HEADS",
    onCoinSideChange: vi.fn(),
    rouletteSpots: [],
    onRouletteClear: vi.fn(),
    kenoSpots: [],
    onKenoChange: vi.fn(),
    onKenoResetResult: vi.fn(),
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
    expect(screen.getByText("1,450.00 USDC")).toBeDefined();
    expect(screen.getByText("VRF estimate")).toBeDefined();
    expect(screen.getByText("1.98x")).toBeDefined();
    expect(screen.getByText("50.00%")).toBeDefined();
    expect(screen.getByRole("button", { name: "CONNECT WALLET" })).toBeDefined();
  });

  it("routes amount shortcuts and place action through callbacks", () => {
    const props = renderPanel({ hasAccount: true });

    fireEvent.click(screen.getByRole("button", { name: "Min" }));
    expect(props.onBetAmountChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "PLACE BET" }));
    expect(props.onPlaceBet).toHaveBeenCalledTimes(1);
  });

  it("exposes deterministic CTA label and disabled helpers", () => {
    expect(getPlaceBetButtonLabel({ hasAccount: false, state: baseState, isPending: false })).toBe(
      "CONNECT WALLET"
    );
    expect(
      getPlaceBetButtonLabel({
        hasAccount: true,
        state: { status: "idle", plan: { preview: { needsApproval: true } } },
        isPending: false
      })
    ).toBe("APPROVE, THEN PLACE BET");
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
