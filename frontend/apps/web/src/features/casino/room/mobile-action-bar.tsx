import * as React from "react";
import { useTranslations } from "next-intl";

import { clampBetAmount, resolveBetMaxAmount } from "./bet-panel-sections";
import type { GameMeta } from "./model";
import { PlaceBetButton } from "./place-bet-button";

export function MobileCasinoActionBar({
  game,
  assetSymbol,
  betAmount,
  maxBetAmount,
  walletBalanceAmount,
  onBetAmountChange,
  hasAccount,
  isPending,
  winChance,
  state,
  onPlaceBet
}: {
  game: GameMeta;
  assetSymbol: string;
  betAmount: number;
  /** Per-roll pool cap; combined with wallet balance for the Max quick action. */
  maxBetAmount?: number;
  walletBalanceAmount?: number | null;
  onBetAmountChange?: (amount: number) => void;
  hasAccount: boolean;
  isPending: boolean;
  winChance: number;
  state: React.ComponentProps<typeof PlaceBetButton>["state"];
  onPlaceBet: () => void;
}) {
  const t = useTranslations();
  const maxAmount = resolveBetMaxAmount(walletBalanceAmount, maxBetAmount);
  const adjust = (next: number) => onBetAmountChange?.(clampBetAmount(next, maxAmount));

  // Thumb-zone quick amounts so a bet can be sized without scrolling up to the
  // full panel. Only shown when amount control is wired and not mid-round.
  const quickButtons: Array<{ key: string; label: string; onClick: () => void }> = [
    { key: "half", label: "½", onClick: () => adjust(betAmount / 2) },
    { key: "double", label: "2×", onClick: () => adjust(betAmount * 2) },
    {
      key: "max",
      label: t("casino.room.betPanel.amount.max"),
      onClick: () => adjust(maxAmount ?? betAmount)
    }
  ];
  const showQuick = Boolean(onBetAmountChange) && !isPending;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            {t("casino.room.betPanel.amount.label")}
          </p>
          <p className="truncate font-mono text-base font-semibold text-fg">
            {betAmount.toFixed(2)} {assetSymbol}
          </p>
        </div>
        {showQuick ? (
          <div className="flex shrink-0 gap-1">
            {quickButtons.map((button) => (
              <button
                key={button.key}
                type="button"
                onClick={button.onClick}
                className="min-w-[2.75rem] rounded-md border border-border-soft bg-surface-0 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
              >
                {button.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <PlaceBetButton
        gameSlug={game.slug}
        hasAccount={hasAccount}
        isPending={isPending}
        winChance={winChance}
        state={state}
        onClick={onPlaceBet}
        density="compact"
      />
    </div>
  );
}
