import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileCasinoActionBar } from "./mobile-action-bar";
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
      "casino.room.betPanel.amount.aria": "Bet amount",
      "casino.room.betPanel.amount.max": "Max",
      "casino.room.betPanel.placeBet.connectWallet": "CONNECT WALLET",
      "casino.room.betPanel.placeBet.failedRetry": "TRANSACTION FAILED - RETRY",
      "casino.room.betPanel.placeBet.roundInProgress": "ROUND IN PROGRESS",
      "casino.room.betPanel.placeBet.betMined": "BET MINED...",
      "casino.room.betPanel.placeBet.signing": "SIGNING / PLACING...",
      "casino.room.betPanel.placeBet.reduceAmount": "REDUCE AMOUNT",
      "casino.room.betPanel.placeBet.revealing": "REVEALING...",
      "casino.room.betPanel.placeBet.approveThenPlace": "APPROVE, THEN PLACE BET",
      "casino.room.betPanel.placeBet.preparing": "PREPARING ROUND...",
      "casino.room.betPanel.placeBet.placeBet": "PLACE BET",
      "casino.room.roundStatus.phases.loadingQuote.status": "Estimating",
      "casino.room.roundStatus.phases.waitingVrf.status": "Waiting for draw",
      "casino.room.roundStatus.phases.settling.status": "Settling",
      "casino.room.roundStatus.actions.settleResult": "Settle result",
      "casino.room.roundStatus.actions.refundStake": "Refund stake",
      "casino.room.shell.noCapacity": "No capacity"
    })[key] ?? key
}));

const diceGame: GameMeta = {
  gameId: "0x1111111111111111111111111111111111111111",
  slug: "dice",
  label: "Precision Dice",
  module: "0x2222222222222222222222222222222222222222"
};

function renderActionBar(
  overrides: Partial<React.ComponentProps<typeof MobileCasinoActionBar>> = {}
) {
  const props: React.ComponentProps<typeof MobileCasinoActionBar> = {
    game: diceGame,
    assetSymbol: "USDC",
    betAmount: 10,
    walletBalanceAmount: 100,
    maxBetAmount: 200,
    onBetAmountChange: vi.fn(),
    hasAccount: true,
    isPending: false,
    winChance: 50,
    state: { status: "idle" },
    roundPhase: "ready",
    onPlaceBet: vi.fn(),
    ...overrides
  };

  render(<MobileCasinoActionBar {...props} />);
  return props;
}

describe("MobileCasinoActionBar", () => {
  afterEach(() => cleanup());

  it("renders an editable amount input and compact place button", () => {
    renderActionBar();

    expect((screen.getByRole("textbox", { name: "Bet amount" }) as HTMLInputElement).value).toBe(
      "10"
    );
    expect(screen.getByRole("button", { name: "PLACE BET" })).toBeDefined();
  });

  it("parses typed amounts through the same bet amount sanitizer as the panel", () => {
    const props = renderActionBar();

    fireEvent.change(screen.getByRole("textbox", { name: "Bet amount" }), {
      target: { value: "abc25.55xyz" }
    });

    expect(props.onBetAmountChange).toHaveBeenCalledWith(25.55);
  });

  it("caps the Max quick action by the lower of wallet balance and pool max bet", () => {
    const cappedByWallet = renderActionBar({
      walletBalanceAmount: 100,
      maxBetAmount: 200
    });

    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(cappedByWallet.onBetAmountChange).toHaveBeenCalledWith(100);

    cleanup();
    const cappedByPool = renderActionBar({
      walletBalanceAmount: 1000,
      maxBetAmount: 200
    });

    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(cappedByPool.onBetAmountChange).toHaveBeenCalledWith(200);
  });

  it("does not expose quick max when the effective max is below the minimum bet", () => {
    renderActionBar({
      walletBalanceAmount: 0,
      maxBetAmount: 200
    });

    expect(screen.queryByRole("button", { name: "Max" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Bet amount" }) as HTMLInputElement).disabled).toBe(
      true
    );
    expect(
      (screen.getByRole("button", { name: "No capacity" }) as HTMLButtonElement).disabled
    ).toBe(true);

    cleanup();
    renderActionBar({
      walletBalanceAmount: 100,
      maxBetAmount: 0.009
    });

    expect(screen.queryByRole("button", { name: "Max" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Bet amount" }) as HTMLInputElement).disabled).toBe(
      true
    );
    expect(
      (screen.getByRole("button", { name: "No capacity" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("blocks the compact CTA when the current amount exceeds the effective max", () => {
    renderActionBar({
      betAmount: 10,
      walletBalanceAmount: 100,
      maxBetAmount: 5
    });

    expect(
      (screen.getByRole("button", { name: "REDUCE AMOUNT" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("locks amount edits and quick actions while a round is pending", () => {
    const props = renderActionBar({ isPending: true });

    fireEvent.change(screen.getByRole("textbox", { name: "Bet amount" }), {
      target: { value: "25" }
    });

    expect(props.onBetAmountChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Max" })).toBeNull();
  });

  it("shows player-facing round progress on the compact CTA", () => {
    renderActionBar({
      isPending: true,
      state: { status: "mined" },
      roundPhase: "revealing"
    });

    expect(screen.getByRole("button", { name: "REVEALING..." })).toBeDefined();

    cleanup();
    renderActionBar({
      isPending: true,
      state: { status: "mined" },
      roundPhase: "waiting_vrf"
    });

    expect(screen.getByRole("button", { name: "Waiting for draw" })).toBeDefined();
  });
});
