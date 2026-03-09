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

function summarizeRisk(cap: number) {
  if (cap <= 10) return "High-risk lane";
  if (cap <= 35) return "Aggressive lane";
  if (cap <= 70) return "Balanced lane";
  return "Safer lane";
}

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
  const capNumber = Number(cap) || 0;
  const riskLabel = summarizeRisk(capNumber);
  const progressPct = Math.max(2, Math.min(98, capNumber));

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dice lane</div>
        <div className="text-2xl font-black tracking-tight text-white">{title}</div>
        {description ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>

      <div className="rounded-[1.9rem] border border-violet-400/15 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_24%),radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_38%),linear-gradient(180deg,rgba(30,14,49,0.96),rgba(8,12,24,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-5 rounded-[1.75rem] border border-fuchsia-300/10 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.2),transparent_32%),linear-gradient(180deg,rgba(31,12,48,0.92),rgba(10,15,28,0.98))] px-6 py-6 text-center shadow-[0_24px_70px_rgba(76,29,149,0.18)]">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hit under</Label>

            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(76,29,149,0.34),rgba(15,23,42,0.84))] shadow-[0_0_0_14px_rgba(15,23,42,0.55)]">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Win chance</div>
                <div className="mt-2 flex items-end justify-center gap-1">
                  <span className="text-6xl font-black text-white">{cap}</span>
                  <span className="pb-1 text-xl font-semibold text-slate-400">%</span>
                </div>
              </div>
            </div>

            <div className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
              {riskLabel}
            </div>

            <p className="max-w-[18rem] text-sm leading-6 text-slate-400">
              Lower caps are harder to hit and push the payout higher. Lock the lane here, then size the ticket on the right.
            </p>
          </div>

          <div className="space-y-5 rounded-[1.75rem] border border-fuchsia-300/10 bg-slate-950/35 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Choose your lane</div>
                <div className="text-sm font-semibold text-white">{riskLabel}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                {cap}% locked
              </div>
            </div>

            <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950/30 p-5">
              <div className="space-y-3">
                <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(248,113,113,0.9),rgba(236,72,153,0.95),rgba(59,130,246,0.9))]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
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
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-4 text-center transition-all duration-200",
                        cap === String(preset)
                          ? "border-fuchsia-300/70 bg-fuchsia-500/25 text-white shadow-[0_16px_40px_rgba(192,38,211,0.24)]"
                          : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:text-white"
                      )}
                      disabled={disabled}
                      onClick={() => onCapChange?.(String(preset))}
                    >
                      <div className="text-lg font-black">{preset}%</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {summarizeRisk(preset)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Risk label", value: riskLabel },
                { label: "Next step", value: "Size ticket" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm font-medium text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
