import * as React from "react";
import {
  ChartBarIcon,
  ChevronDownIcon,
  CurrencyDollarIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

export function parseWalletBalanceAmount(walletBalance: string | null) {
  return walletBalance ? parseFloat(walletBalance.replace(/,/g, "").replace(" USDC", "")) : 1450;
}

export function BetAmountSection({
  betAmount,
  walletBalance,
  isPending,
  onBetAmountChange
}: {
  betAmount: number;
  walletBalance: string | null;
  isPending: boolean;
  onBetAmountChange: (amount: number) => void;
}) {
  const setRoundedBetAmount = (value: number) => {
    onBetAmountChange(Math.floor(Math.max(1, value)));
  };

  return (
    <div className="mb-6">
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
        Bet Amount
      </label>
      <div
        className={cn(
          "relative flex flex-col gap-2 rounded-xl border border-border bg-surface-0 p-2 shadow-inner-e1",
          isPending ? "opacity-50" : "focus-within:border-brand/40"
        )}
      >
        <div className="flex items-center px-4 pt-2">
          <CurrencyDollarIcon className="h-6 w-6 text-fg-subtle" />
          <input
            type="number"
            aria-label="Bet amount"
            value={betAmount}
            onChange={(event) => onBetAmountChange(Math.max(1, parseInt(event.target.value) || 0))}
            className="w-full border-none bg-transparent pr-2 text-right font-mono text-4xl text-fg outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border-soft bg-surface-1 p-1">
          <button
            type="button"
            onClick={() => setRoundedBetAmount(1)}
            className="flex-1 rounded-md bg-surface-0 py-1.5 text-[10px] font-bold uppercase text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            Min
          </button>
          <button
            type="button"
            onClick={() => setRoundedBetAmount(betAmount / 2)}
            className="flex-1 rounded-md bg-surface-0 py-1.5 text-[10px] font-bold uppercase text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            1/2
          </button>
          <button
            type="button"
            onClick={() => setRoundedBetAmount(betAmount * 2)}
            className="flex-1 rounded-md bg-surface-0 py-1.5 text-[10px] font-bold uppercase text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            2x
          </button>
          <button
            type="button"
            onClick={() => setRoundedBetAmount(parseWalletBalanceAmount(walletBalance))}
            className="flex-1 rounded-md bg-surface-0 py-1.5 text-[10px] font-bold uppercase text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            Max
          </button>
        </div>
      </div>
    </div>
  );
}

export function BetRollsSection({
  betAmount,
  betCount,
  isPending,
  onBetCountChange
}: {
  betAmount: number;
  betCount: number;
  isPending: boolean;
  onBetCountChange: (count: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          Rolls
        </label>
        {betCount > 1 && (
          <span className="font-mono text-[10px] text-fg-subtle">
            Total: {(betAmount * betCount).toLocaleString()} USDC
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
              "flex-1 rounded-lg border py-2.5 text-xs font-black uppercase tracking-wide transition-colors",
              betCount === count
                ? "border-brand bg-brand text-fg-inverse shadow-glow"
                : "border-border bg-surface-1 text-fg-subtle hover:border-brand/40 hover:bg-surface-2 hover:text-fg"
            )}
          >
            {count === 1 ? "1x" : `${count}x`}
          </button>
        ))}
        <input
          type="number"
          min={1}
          max={100}
          aria-label="Roll count"
          value={betCount}
          onChange={(event) =>
            onBetCountChange(Math.max(1, Math.min(100, parseInt(event.target.value) || 1)))
          }
          disabled={isPending}
          className="w-14 rounded-lg border border-border bg-surface-1 text-center font-mono text-xs text-fg focus:border-brand/40 focus:outline-none"
        />
      </div>
    </div>
  );
}

export function BetAdvancedSection({
  advancedOpen,
  stopGain,
  stopLoss,
  onAdvancedOpenChange,
  onStopGainChange,
  onStopLossChange
}: {
  advancedOpen: boolean;
  stopGain: number;
  stopLoss: number;
  onAdvancedOpenChange: (open: boolean) => void;
  onStopGainChange: (amount: number) => void;
  onStopLossChange: (amount: number) => void;
}) {
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => onAdvancedOpenChange(!advancedOpen)}
        className="flex w-full items-center justify-between border-b border-border-soft pb-2 text-[10px] font-bold uppercase tracking-widest text-fg-subtle transition-colors hover:text-fg-muted"
      >
        <span>Advanced</span>
        <ChevronDownIcon
          className={cn("h-3 w-3 transition-transform duration-200", advancedOpen && "rotate-180")}
        />
      </button>
      {advancedOpen && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-fg-subtle">
              Stop Gain (USDC)
            </label>
            <input
              type="number"
              min={0}
              value={stopGain}
              onChange={(event) => onStopGainChange(Math.max(0, parseInt(event.target.value) || 0))}
              placeholder="0 = off"
              className="rounded-lg border border-border bg-surface-1 px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-success/40 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-fg-subtle">
              Stop Loss (USDC)
            </label>
            <input
              type="number"
              min={0}
              value={stopLoss}
              onChange={(event) => onStopLossChange(Math.max(0, parseInt(event.target.value) || 0))}
              placeholder="0 = off"
              className="rounded-lg border border-border bg-surface-1 px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-danger/40 focus:outline-none"
            />
          </div>
          {(stopGain > 0 || stopLoss > 0) && (
            <div className="col-span-2 font-mono text-[9px] text-fg-subtle">
              {stopGain > 0 && <span className="text-success">Gain stop at +{stopGain} USDC</span>}
              {stopGain > 0 && stopLoss > 0 && <span className="mx-2">|</span>}
              {stopLoss > 0 && <span className="text-danger">Loss stop at {stopLoss} USDC</span>}
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
  expectedPayout
}: {
  multiplier: number;
  winChance: number;
  expectedPayout: number;
}) {
  return (
    <div className="mb-auto grid grid-cols-2 gap-4">
      <div className="flex flex-col rounded-lg border border-border bg-surface-0 p-4 shadow-inner-e1">
        <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          Multiplier <InformationCircleIcon className="h-3 w-3" />
        </span>
        <span className="font-mono text-2xl font-bold text-brand transition-colors">
          {multiplier.toFixed(2)}x
        </span>
      </div>
      <div className="flex flex-col rounded-lg border border-border bg-surface-0 p-4 shadow-inner-e1">
        <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          Win Chance <ChartBarIcon className="h-3 w-3" />
        </span>
        <span className="font-mono text-2xl font-bold text-fg">{winChance.toFixed(2)}%</span>
      </div>
      <div className="col-span-2 flex select-none flex-col rounded-lg border border-border bg-surface-0 p-4 shadow-inner-e1">
        <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          Expected Payout
        </span>
        <span className="flex items-baseline gap-2 font-mono text-3xl font-extrabold text-brand">
          {expectedPayout.toFixed(2)} <span className="text-sm font-bold text-fg-subtle">USDC</span>
        </span>
      </div>
    </div>
  );
}
