import * as React from "react";

import { cn } from "../../lib/utils";

export type CoinTossSide = "heads" | "tails";

export type CoinTossParamsFormProps = {
  title?: string;
  description?: string;
  side: CoinTossSide;
  onSideChange?: (side: CoinTossSide) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function CoinTossParamsForm(props: CoinTossParamsFormProps) {
  const {
    title = "Coin Toss",
    description = "Choose heads or tails.",
    side,
    onSideChange,
    disabled = false,
    error,
    className,
  } = props;

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Choose a side</div>
        <div className="text-2xl font-black tracking-tight text-white">{title}</div>
        {description ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          className={cn(
            "relative overflow-hidden rounded-[1.75rem] border p-8 text-left transition-all duration-200",
            side === "heads"
              ? "border-emerald-300/70 bg-emerald-400/15 shadow-[0_24px_60px_rgba(16,185,129,0.18)]"
              : "border-slate-800 bg-slate-950/45 hover:border-slate-600"
          )}
          disabled={disabled}
          onClick={() => onSideChange?.("heads")}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Option A</div>
          <div className={cn("mt-4 text-4xl font-black tracking-tight", side === "heads" ? "text-white" : "text-slate-300")}>
            Heads
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-400">Fastest path: one outcome, one stake, one settlement trace.</div>
        </button>

        <button
          type="button"
          className={cn(
            "relative overflow-hidden rounded-[1.75rem] border p-8 text-left transition-all duration-200",
            side === "tails"
              ? "border-violet-300/70 bg-violet-400/15 shadow-[0_24px_60px_rgba(139,92,246,0.18)]"
              : "border-slate-800 bg-slate-950/45 hover:border-slate-600"
          )}
          disabled={disabled}
          onClick={() => onSideChange?.("tails")}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Option B</div>
          <div className={cn("mt-4 text-4xl font-black tracking-tight", side === "tails" ? "text-white" : "text-slate-300")}>
            Tails
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-400">Same execution path, different face. Keep the choice binary and obvious.</div>
        </button>
      </div>

      {error ? <p className="text-sm font-medium text-rose-300">{error}</p> : null}
    </div>
  );
}
