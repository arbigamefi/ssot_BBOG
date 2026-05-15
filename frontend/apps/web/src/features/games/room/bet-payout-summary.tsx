import * as React from "react";
import { ChartBarIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

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
