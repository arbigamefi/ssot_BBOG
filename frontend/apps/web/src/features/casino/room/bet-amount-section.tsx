import * as React from "react";
import { CurrencyDollarIcon } from "@heroicons/react/24/outline";
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
