import * as React from "react";
import { useTranslations } from "next-intl";
import { ChartBarIcon, ChevronDownIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { TokenLogo } from "../../../components/TokenLogo";
import {
  clampBetAmountInput,
  formatBetAmountRaw,
  isBetAmountUnavailable,
  getMinBetAmountInput,
  multiplyBetAmountInput,
  normalizeBetAmountInput,
  resolveBetMaxRaw,
  scaleBetAmountInput
} from "./bet-amount";

const WHOLE_UNIT_PATTERN = "[0-9]*";
const BET_AMOUNT_PATTERN = "[0-9]*[.]?[0-9]*";

function parseWholeUnitInput(input: string, { min, max }: { min: number; max?: number }) {
  const digits = input.match(/\d+/)?.[0] ?? "";
  if (!digits) return min;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return max ?? min;
  return Math.max(min, Math.min(max ?? value, value));
}

export function BetAmountSection({
  betAmount,
  maxBetRaw,
  walletBalanceRaw,
  assetDecimals,
  assetSymbol,
  isPending,
  onBetAmountChange
}: {
  betAmount: string;
  maxBetRaw?: bigint;
  walletBalanceRaw: bigint | null;
  assetDecimals: number;
  assetSymbol: string;
  isPending: boolean;
  onBetAmountChange: (amount: string) => void;
}) {
  const t = useTranslations();
  const maxRaw = resolveBetMaxRaw(walletBalanceRaw, maxBetRaw);
  const amountUnavailable = isBetAmountUnavailable(assetDecimals, maxRaw);
  const maxShortcutUnavailable = maxRaw == null;
  const setBetAmount = (value: string) =>
    onBetAmountChange(clampBetAmountInput(value, assetDecimals, maxRaw));
  const controlsDisabled = isPending || amountUnavailable;

  return (
    <div className="mb-2">
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
        {t("casino.room.betPanel.amount.label")}
      </label>
      <div
        className={cn(
          "relative flex flex-col gap-1.5 rounded-xl border border-border bg-surface-0 p-2 shadow-inner-e1",
          isPending ? "opacity-50" : "focus-within:border-brand/40"
        )}
      >
        <div className="flex items-center gap-1 px-3">
          <TokenLogo symbol={assetSymbol} size={20} />
          <input
            type="text"
            inputMode="decimal"
            pattern={BET_AMOUNT_PATTERN}
            autoComplete="off"
            aria-label={t("casino.room.betPanel.amount.aria")}
            value={betAmount}
            onChange={(event) => {
              if (controlsDisabled) return;
              onBetAmountChange(normalizeBetAmountInput(event.target.value, assetDecimals));
            }}
            onBlur={() => setBetAmount(betAmount)}
            disabled={controlsDisabled}
            className="w-full border-none bg-transparent pr-2 text-right font-mono text-2xl text-fg outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border-soft bg-surface-1 p-1">
          <button
            type="button"
            onClick={() => setBetAmount(getMinBetAmountInput(assetDecimals))}
            disabled={controlsDisabled}
            className="flex-1 rounded-md bg-surface-0 py-1 text-[10px] font-bold uppercase text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-default disabled:opacity-50 disabled:hover:bg-surface-0 disabled:hover:text-fg-subtle"
          >
            {t("casino.room.betPanel.amount.min")}
          </button>
          <button
            type="button"
            onClick={() =>
              onBetAmountChange(
                scaleBetAmountInput({
                  input: betAmount,
                  decimals: assetDecimals,
                  numerator: 1n,
                  denominator: 2n,
                  maxRaw
                })
              )
            }
            disabled={controlsDisabled}
            className="flex-1 rounded-md bg-surface-0 py-1 text-[10px] font-bold uppercase text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-default disabled:opacity-50 disabled:hover:bg-surface-0 disabled:hover:text-fg-subtle"
          >
            1/2
          </button>
          <button
            type="button"
            onClick={() =>
              onBetAmountChange(
                scaleBetAmountInput({
                  input: betAmount,
                  decimals: assetDecimals,
                  numerator: 2n,
                  maxRaw
                })
              )
            }
            disabled={controlsDisabled}
            className="flex-1 rounded-md bg-surface-0 py-1 text-[10px] font-bold uppercase text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-default disabled:opacity-50 disabled:hover:bg-surface-0 disabled:hover:text-fg-subtle"
          >
            2x
          </button>
          <button
            type="button"
            onClick={() => onBetAmountChange(formatBetAmountRaw(maxRaw ?? 0n, assetDecimals))}
            disabled={controlsDisabled || maxShortcutUnavailable}
            className="flex-1 rounded-md bg-surface-0 py-1 text-[10px] font-bold uppercase text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-default disabled:opacity-50 disabled:hover:bg-surface-0 disabled:hover:text-fg-subtle"
          >
            {t("casino.room.betPanel.amount.max")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BetRollsSection({
  betAmount,
  betCount,
  assetDecimals,
  assetSymbol,
  isPending,
  onBetCountChange
}: {
  betAmount: string;
  betCount: number;
  assetDecimals: number;
  assetSymbol: string;
  isPending: boolean;
  onBetCountChange: (count: number) => void;
}) {
  const t = useTranslations();

  return (
    <div className="mb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          {t("casino.room.betPanel.rolls.label")}
        </label>
        {betCount > 1 && (
          <span className="font-mono text-[10px] text-fg-subtle">
            {t("casino.room.betPanel.rolls.total", {
              amount: multiplyBetAmountInput(betAmount, betCount, assetDecimals),
              symbol: assetSymbol
            })}
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 5, 10].map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => onBetCountChange(count)}
            disabled={isPending}
            className={cn(
              "flex-1 rounded-lg border py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
              betCount === count
                ? "border-brand bg-brand text-fg-inverse shadow-e1"
                : "border-border bg-surface-1 text-fg-subtle hover:border-brand/40 hover:bg-surface-2 hover:text-fg"
            )}
          >
            {count === 1 ? "1x" : `${count}x`}
          </button>
        ))}
        <input
          type="text"
          inputMode="numeric"
          pattern={WHOLE_UNIT_PATTERN}
          autoComplete="off"
          aria-label={t("casino.room.betPanel.rolls.aria")}
          value={String(betCount)}
          onChange={(event) => {
            if (isPending) return;
            onBetCountChange(parseWholeUnitInput(event.target.value, { min: 1, max: 100 }));
          }}
          disabled={isPending}
          className="w-14 rounded-lg border border-border bg-surface-1 text-center font-mono text-xs text-fg focus:border-brand/40 focus:outline-none"
        />
      </div>
    </div>
  );
}

export function BetAdvancedSection({
  advancedOpen,
  assetSymbol,
  isPending,
  stopGain,
  stopLoss,
  onAdvancedOpenChange,
  onStopGainChange,
  onStopLossChange
}: {
  advancedOpen: boolean;
  assetSymbol: string;
  isPending?: boolean;
  stopGain: number;
  stopLoss: number;
  onAdvancedOpenChange: (open: boolean) => void;
  onStopGainChange: (amount: number) => void;
  onStopLossChange: (amount: number) => void;
}) {
  const t = useTranslations();
  const advancedContentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!advancedOpen) return;
    const frame = window.requestAnimationFrame(() => {
      advancedContentRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [advancedOpen]);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => onAdvancedOpenChange(!advancedOpen)}
        disabled={isPending}
        className="flex w-full items-center justify-between border-b border-border-soft pb-1.5 text-[10px] font-bold uppercase tracking-widest text-fg-subtle transition-colors hover:text-fg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:text-fg-subtle"
      >
        <span>{t("casino.room.betPanel.advanced.label")}</span>
        <ChevronDownIcon
          className={cn("h-3 w-3 transition-transform duration-200", advancedOpen && "rotate-180")}
        />
      </button>
      {advancedOpen && (
        <div ref={advancedContentRef} className="mt-2 grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-fg-subtle">
              {t("casino.room.betPanel.advanced.stopGain", { symbol: assetSymbol })}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern={WHOLE_UNIT_PATTERN}
              autoComplete="off"
              aria-label={t("casino.room.betPanel.advanced.stopGain", { symbol: assetSymbol })}
              value={String(stopGain)}
              disabled={isPending}
              onChange={(event) => {
                if (isPending) return;
                onStopGainChange(parseWholeUnitInput(event.target.value, { min: 0 }));
              }}
              placeholder={t("casino.room.betPanel.advanced.offPlaceholder")}
              className="rounded-lg border border-border bg-surface-1 px-3 py-1.5 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-success/40 focus:outline-none disabled:cursor-default disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-fg-subtle">
              {t("casino.room.betPanel.advanced.stopLoss", { symbol: assetSymbol })}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern={WHOLE_UNIT_PATTERN}
              autoComplete="off"
              aria-label={t("casino.room.betPanel.advanced.stopLoss", { symbol: assetSymbol })}
              value={String(stopLoss)}
              disabled={isPending}
              onChange={(event) => {
                if (isPending) return;
                onStopLossChange(parseWholeUnitInput(event.target.value, { min: 0 }));
              }}
              placeholder={t("casino.room.betPanel.advanced.offPlaceholder")}
              className="rounded-lg border border-border bg-surface-1 px-3 py-1.5 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-danger/40 focus:outline-none disabled:cursor-default disabled:opacity-60"
            />
          </div>
          {(stopGain > 0 || stopLoss > 0) && (
            <div className="col-span-2 font-mono text-[9px] text-fg-subtle">
              {stopGain > 0 && (
                <span className="text-success">
                  {t("casino.room.betPanel.advanced.gainStop", {
                    amount: stopGain,
                    symbol: assetSymbol
                  })}
                </span>
              )}
              {stopGain > 0 && stopLoss > 0 && <span className="mx-2">|</span>}
              {stopLoss > 0 && (
                <span className="text-danger">
                  {t("casino.room.betPanel.advanced.lossStop", {
                    amount: stopLoss,
                    symbol: assetSymbol
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BetPayoutSummary({
  multiplier,
  winChance,
  expectedPayout,
  assetSymbol
}: {
  multiplier: number;
  winChance: number;
  expectedPayout: number;
  assetSymbol: string;
}) {
  const t = useTranslations();

  return (
    <div className="mb-2 grid grid-cols-2 gap-2">
      <div className="flex flex-col rounded-lg border border-border bg-surface-0 p-2 shadow-inner-e1">
        <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          {t("casino.room.betPanel.summary.multiplier")}{" "}
          <InformationCircleIcon className="h-3 w-3" />
        </span>
        <span className="font-mono text-lg font-bold text-brand transition-colors">
          {multiplier.toFixed(2)}x
        </span>
      </div>
      <div className="flex flex-col rounded-lg border border-border bg-surface-0 p-2 shadow-inner-e1">
        <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          {t("casino.room.betPanel.summary.winChance")} <ChartBarIcon className="h-3 w-3" />
        </span>
        <span className="font-mono text-lg font-bold text-fg">{winChance.toFixed(2)}%</span>
      </div>
      <div className="col-span-2 flex select-none items-center justify-between gap-3 rounded-lg border border-border bg-surface-0 p-2 shadow-inner-e1">
        <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          {t("casino.room.betPanel.summary.expectedPayout")}
        </span>
        <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap font-mono text-lg font-bold text-brand">
          {expectedPayout.toFixed(2)}{" "}
          <span className="text-xs font-bold text-fg-subtle">{assetSymbol}</span>
        </span>
      </div>
    </div>
  );
}
