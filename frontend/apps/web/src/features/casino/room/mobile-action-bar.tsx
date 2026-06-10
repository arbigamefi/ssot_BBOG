import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { TokenLogo } from "../../../components/TokenLogo";
import {
  clampBetAmountInput,
  formatBetAmountRaw,
  getMinBetAmountInput,
  isBetAmountAboveMax,
  isBetAmountUnavailable,
  normalizeBetAmountInput,
  resolveBetMaxRaw,
  scaleBetAmountInput
} from "./bet-amount";
import type { GameMeta } from "./model";
import type { PlaceBetButtonPhase } from "./place-bet-button";
import { PlaceBetButton } from "./place-bet-button";

const BET_AMOUNT_PATTERN = "[0-9]*[.]?[0-9]*";

export function MobileCasinoActionBar({
  game,
  assetSymbol,
  assetDecimals,
  betAmount,
  maxBetRaw,
  walletBalanceRaw,
  onBetAmountChange,
  hasAccount,
  isPending,
  winChance,
  state,
  roundPhase,
  manualSettleAvailable = false,
  onManualSettle,
  manualRefundAvailable = false,
  onManualRefund,
  onPlaceBet
}: {
  game: GameMeta;
  assetSymbol: string;
  assetDecimals: number;
  betAmount: string;
  /** Per-roll pool cap; combined with wallet balance for the Max quick action. */
  maxBetRaw?: bigint;
  walletBalanceRaw?: bigint | null;
  onBetAmountChange?: (amount: string) => void;
  hasAccount: boolean;
  isPending: boolean;
  winChance: number;
  state: React.ComponentProps<typeof PlaceBetButton>["state"];
  roundPhase: PlaceBetButtonPhase;
  manualSettleAvailable?: boolean;
  onManualSettle?: () => void;
  manualRefundAvailable?: boolean;
  onManualRefund?: () => void;
  onPlaceBet: () => void;
}) {
  const t = useTranslations();
  const primaryAction =
    manualRefundAvailable && onManualRefund
      ? onManualRefund
      : manualSettleAvailable && onManualSettle
        ? onManualSettle
        : onPlaceBet;
  const maxRaw = resolveBetMaxRaw(walletBalanceRaw, maxBetRaw);
  const amountUnavailable = isBetAmountUnavailable(assetDecimals, maxRaw);
  const amountExceedsMax = isBetAmountAboveMax(betAmount, assetDecimals, maxRaw);
  const adjust = (next: string) =>
    onBetAmountChange?.(clampBetAmountInput(next, assetDecimals, maxRaw));

  // Thumb-zone quick amounts so a bet can be sized without scrolling up to the
  // full panel. Only shown when amount control is wired and not mid-round.
  const quickButtons: Array<{ key: string; label: string; onClick: () => void }> = [
    {
      key: "half",
      label: "½",
      onClick: () =>
        onBetAmountChange?.(
          scaleBetAmountInput({
            input: betAmount,
            decimals: assetDecimals,
            numerator: 1n,
            denominator: 2n,
            maxRaw
          })
        )
    },
    {
      key: "double",
      label: "2×",
      onClick: () =>
        onBetAmountChange?.(
          scaleBetAmountInput({
            input: betAmount,
            decimals: assetDecimals,
            numerator: 2n,
            maxRaw
          })
        )
    },
    {
      key: "max",
      label: t("casino.room.betPanel.amount.max"),
      onClick: () => onBetAmountChange?.(formatBetAmountRaw(maxRaw ?? 0n, assetDecimals))
    }
  ];
  const showQuick = Boolean(onBetAmountChange) && !isPending && !amountUnavailable;
  const controlsDisabled = isPending || amountUnavailable;

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
            value={betAmount}
            disabled={controlsDisabled}
            onChange={(event) => {
              if (controlsDisabled) return;
              onBetAmountChange?.(normalizeBetAmountInput(event.target.value, assetDecimals));
            }}
            onBlur={() => adjust(betAmount || getMinBetAmountInput(assetDecimals))}
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
        roundPhase={roundPhase}
        manualSettleAvailable={manualSettleAvailable}
        manualRefundAvailable={manualRefundAvailable}
        amountUnavailable={amountUnavailable}
        amountExceedsMax={amountExceedsMax}
        onClick={primaryAction}
        density="compact"
      />
    </div>
  );
}
