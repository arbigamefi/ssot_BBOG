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
      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
        Bet Amount
      </label>
      <div
        className={cn(
          "bg-[#050505] border border-white/10 rounded-[1.5rem] p-2 flex flex-col gap-2 relative shadow-inner",
          isPending ? "opacity-50" : "focus-within:border-white/20"
        )}
      >
        <div className="flex items-center px-4 pt-2">
          <CurrencyDollarIcon className="w-6 h-6 text-white/20" />
          <input
            type="number"
            value={betAmount}
            onChange={(event) => onBetAmountChange(Math.max(1, parseInt(event.target.value) || 0))}
            className="bg-transparent border-none outline-none text-4xl font-mono text-white w-full pr-2 text-right"
          />
        </div>
        <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setRoundedBetAmount(1)}
            className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
          >
            Min
          </button>
          <button
            type="button"
            onClick={() => setRoundedBetAmount(betAmount / 2)}
            className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
          >
            1/2
          </button>
          <button
            type="button"
            onClick={() => setRoundedBetAmount(betAmount * 2)}
            className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
          >
            2x
          </button>
          <button
            type="button"
            onClick={() => setRoundedBetAmount(parseWalletBalanceAmount(walletBalance))}
            className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
          >
            Max
          </button>
        </div>
      </div>
    </div>
  );
}
