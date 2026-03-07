import * as React from "react";

import { Label } from "../ui/label";
import { cn } from "../../lib/utils";

export type DiceParamsFormProps = {
  title?: string;
  description?: string;
  cap: string;
  onCapChange?: (cap: string) => void;
  disabled?: boolean;
  error?: string;
  presets?: number[];
  className?: string;
};

export function DiceParamsForm(props: DiceParamsFormProps) {
  const {
    title = "Dice",
    description = "Choose a cap (payout odds depend on cap).",
    cap,
    onCapChange,
    disabled = false,
    error,
    presets = [2, 5, 10, 25, 50, 75, 95],
    className,
  } = props;

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risk dial</div>
        <div className="text-2xl font-black tracking-tight text-white">{title}</div>
        {description ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>

      <div className="rounded-[1.9rem] border border-violet-400/15 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(8,12,24,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-slate-950/45 px-6 py-5 text-center shadow-[0_24px_70px_rgba(76,29,149,0.18)]">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Win chance</Label>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-7xl font-black text-white">{cap}</span>
              <span className="pb-2 text-2xl font-semibold text-slate-400">%</span>
            </div>
            <div className="mt-4 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
              Live cap selection
            </div>
          </div>

          <div className="space-y-5 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-slate-300">
              Lower cap means harder hit and larger upside. Keep the choice simple, then size the ticket on the right.
            </div>

            <div className="space-y-3">
              <input
                type="range"
                min="2"
                max="98"
                value={cap}
                disabled={disabled}
                onChange={(e) => onCapChange?.(e.target.value)}
                className="h-3 w-full cursor-pointer appearance-none rounded-full bg-black/50 accent-violet-400"
              />
              <div className="flex justify-between text-xs font-medium text-slate-500">
                <span>Riskier (2%)</span>
                <span>Safer (98%)</span>
              </div>
            </div>

            {presets.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={cn(
                      "rounded-2xl border px-3 py-4 text-sm font-bold transition-all duration-200",
                      cap === String(preset)
                        ? "border-violet-300/70 bg-violet-500/25 text-white shadow-[0_16px_40px_rgba(91,33,182,0.24)]"
                        : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:text-white"
                    )}
                    disabled={disabled}
                    onClick={() => onCapChange?.(String(preset))}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm font-medium text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
