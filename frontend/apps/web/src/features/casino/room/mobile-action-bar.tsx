import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { TokenLogo } from "../../../components/TokenLogo";
import {
  clampBetAmount,
  MIN_BET_AMOUNT,
  parseBetAmountInput,
  resolveBetMaxAmount
} from "./bet-panel-sections";
import type { GameMeta } from "./model";
import { PlaceBetButton } from "./place-bet-button";

const BET_AMOUNT_PATTERN = "[0-9]*[.]?[0-9]*";

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
    <div className="space-y-2" data-mobile-bet-action>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <label
          className={cn(
            "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border-soft bg-surface-0 px-3 py-2 shadow-inner-e1",
            isPending && "opacity-55"
          )}
        >
          <TokenLogo symbol={assetSymbol} size={20} />
          <span className="sr-only">{t("casino.room.betPanel.amount.aria")}</span>
          <input
            type="text"
            inputMode="decimal"
            pattern={BET_AMOUNT_PATTERN}
            autoComplete="off"
            aria-label={t("casino.room.betPanel.amount.aria")}
            value={String(betAmount)}
            disabled={isPending}
            onChange={(event) => {
              if (isPending) return;
              onBetAmountChange?.(
                parseBetAmountInput(event.target.value, {
                  min: MIN_BET_AMOUNT,
                  max: maxAmount
                })
              );
            }}
            className="min-w-0 border-none bg-transparent text-right font-mono text-lg font-semibold text-fg outline-none"
          />
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-fg-subtle">
            {assetSymbol}
          </span>
        </label>
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
