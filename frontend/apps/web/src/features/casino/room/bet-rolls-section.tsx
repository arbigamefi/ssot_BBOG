import * as React from "react";
import { cn } from "@ssot/ui";

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
