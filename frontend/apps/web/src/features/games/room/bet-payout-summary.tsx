import * as React from "react";
import { ChartBarIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

function getPrimaryMetricClass(themeColor: string) {
  if (themeColor === "emerald") return "text-emerald-400";
  if (themeColor === "purple") return "text-purple-400";
  return "text-amber-400";
}

function getPayoutClass(themeColor: string) {
  if (themeColor === "emerald") return "text-emerald-400";
  if (themeColor === "purple") return "text-purple-400";
  if (themeColor === "amber") return "text-amber-400";
  return "text-fuchsia-400";
}

function getPayoutUnitClass(themeColor: string) {
  if (themeColor === "emerald") return "text-emerald-500/50";
  if (themeColor === "purple") return "text-purple-500/50";
  if (themeColor === "amber") return "text-amber-500/50";
  return "text-fuchsia-500/50";
}

export function BetPayoutSummary({
  themeColor,
  multiplier,
  winChance,
  expectedPayout
}: {
  themeColor: string;
  multiplier: number;
  winChance: number;
  expectedPayout: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-auto">
      <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
        <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 flex items-center gap-1">
          Multiplier <InformationCircleIcon className="w-3 h-3" />
        </span>
        <span
          className={cn(
            "text-2xl font-mono font-bold transition-all",
            getPrimaryMetricClass(themeColor)
          )}
        >
          {multiplier.toFixed(2)}x
        </span>
      </div>
      <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
        <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 flex items-center gap-1">
          Win Chance <ChartBarIcon className="w-3 h-3" />
        </span>
        <span className="text-2xl font-mono font-bold text-white">{winChance.toFixed(2)}%</span>
      </div>
      <div className="col-span-2 bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)] select-none">
        <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1">
          Expected Payout
        </span>
        <span
          className={cn(
            "text-3xl font-mono font-extrabold flex items-baseline gap-2",
            getPayoutClass(themeColor)
          )}
        >
          {expectedPayout.toFixed(2)}{" "}
          <span className={cn("text-sm font-bold", getPayoutUnitClass(themeColor))}>USDC</span>
        </span>
      </div>
    </div>
  );
}
