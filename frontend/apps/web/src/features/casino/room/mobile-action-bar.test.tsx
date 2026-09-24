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
      "casino.room.betPanel.placeBet.selectToBet": "SELECT A BET",
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
    assetDecimals: 6,
    betAmount: "10",
    walletBalanceRaw: 100_000_000n,
    maxBetRaw: 200_000_000n,
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

    expect(props.onBetAmountChange).toHaveBeenCalledWith("25.55");
  });

  it("caps the Max quick action by the lower of wallet balance and pool max bet", () => {
    const cappedByWallet = renderActionBar({
      walletBalanceRaw: 100_000_000n,
      maxBetRaw: 200_000_000n
    });

    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(cappedByWallet.onBetAmountChange).toHaveBeenCalledWith("100");

    cleanup();
    const cappedByPool = renderActionBar({
      walletBalanceRaw: 1_000_000_000n,
      maxBetRaw: 200_000_000n
    });

    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(cappedByPool.onBetAmountChange).toHaveBeenCalledWith("200");
  });

  it("does not expose quick max when the effective max is below the minimum bet", () => {
    renderActionBar({
      walletBalanceRaw: 0n,
      maxBetRaw: 200_000_000n
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
      walletBalanceRaw: 100_000_000n,
      maxBetRaw: 9_000n
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
      betAmount: "10",
      walletBalanceRaw: 100_000_000n,
      maxBetRaw: 5_000_000n
    });

    expect(
      (screen.getByRole("button", { name: "REDUCE AMOUNT" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("prompts for a selection before enabling non-dice compact rooms", () => {
    renderActionBar({
      game: { ...diceGame, slug: "roulette", label: "Roulette" },
      winChance: 0
    });

    expect(
      (screen.getByRole("button", { name: "SELECT A BET" }) as HTMLButtonElement).disabled
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

  it("keeps amount editable after failure but blocks an oversized retry", () => {
    const props = renderActionBar({
      isPending: true,
      state: { status: "failed", error: { message: "reverted" } },
      betAmount: "10",
      maxBetRaw: 5_000_000n
    });

    const button = screen.getByRole("button", {
      name: "REDUCE AMOUNT"
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox", { name: "Bet amount" }), {
      target: { value: "4" }
    });
    expect(props.onBetAmountChange).toHaveBeenCalledWith("4");

    fireEvent.click(button);
    expect(props.onPlaceBet).not.toHaveBeenCalled();
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
  it("divides the wallet budget across all rolls for Max", () => {
    const props = renderActionBar({ betCount: 4, walletBalanceRaw: 100_000_003n });
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(props.onBetAmountChange).toHaveBeenCalledWith("25");
  });

  it("explains a paused pool beside a disabled CTA without opening a wallet", () => {
    const props = renderActionBar({ poolAvailability: "paused", onRefreshPool: vi.fn() });
    expect(screen.getByRole("status").textContent).toContain("paused");
    const button = screen.getByRole("button", { name: "casino.room.poolStatus.pausedLabel" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(props.onPlaceBet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    expect(props.onRefreshPool).toHaveBeenCalledOnce();
  });

  it("offers a read-only check and explorer link for an unconfirmed transaction", () => {
    const hash = `0x${"ab".repeat(32)}`;
    const props = renderActionBar({
      state: {
        status: "failed",
        error: { code: "TX_TIMEOUT", details: { txHash: hash, chainId: 84532 } }
      },
      onCheckTransaction: vi.fn()
    });
    expect(screen.getByRole("alert").textContent).toContain("casino.room.feedback.unconfirmed");
    expect(
      screen.getByRole("button", { name: "casino.room.feedback.pendingLabel" })
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "casino.room.feedback.viewTransaction" })
    ).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${hash}`);
    fireEvent.click(screen.getByRole("button", { name: "casino.room.feedback.checkTransaction" }));
    expect(props.onCheckTransaction).toHaveBeenCalledOnce();
    expect(props.onPlaceBet).not.toHaveBeenCalled();
  });

  it("keeps existing-bet settlement available when new bets are paused", () => {
    renderActionBar({ poolAvailability: "paused", manualSettleAvailable: true });
    expect(screen.getByRole("button", { name: "Settle result" })).not.toBeDisabled();
  });
});
