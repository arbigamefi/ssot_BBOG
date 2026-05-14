import * as React from "react";
import { cn } from "@ssot/ui";

function getActiveRollButtonClass(themeColor: string) {
  if (themeColor === "purple") {
    return "bg-purple-600 border-purple-400 text-white shadow-[0_0_12px_rgba(147,51,234,0.4)]";
  }
  if (themeColor === "emerald") {
    return "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]";
  }
  if (themeColor === "amber") {
    return "bg-amber-500 border-amber-300 text-amber-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]";
  }
  return "bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]";
}

export function BetRollsSection({
  betAmount,
  betCount,
  isPending,
  themeColor,
  onBetCountChange
}: {
  betAmount: number;
  betCount: number;
  isPending: boolean;
  themeColor: string;
  onBetCountChange: (count: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">
          Rolls
        </label>
        {betCount > 1 && (
          <span className="text-[10px] font-mono text-white/30">
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
              "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border transition-all",
              betCount === count
                ? getActiveRollButtonClass(themeColor)
                : "bg-[#0a0a0a] border-white/10 text-white/40 hover:border-white/20 hover:text-white"
            )}
          >
            {count === 1 ? "1x" : `${count}x`}
          </button>
        ))}
        <input
          type="number"
          min={1}
          max={100}
          value={betCount}
          onChange={(event) =>
            onBetCountChange(Math.max(1, Math.min(100, parseInt(event.target.value) || 1)))
          }
          disabled={isPending}
          className="w-14 text-center bg-[#0a0a0a] border border-white/10 rounded-xl text-xs font-mono text-white focus:border-white/30 focus:outline-none"
        />
      </div>
    </div>
  );
}
