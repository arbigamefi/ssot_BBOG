"use client";

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
  variant?: "default" | "prototype";
};

function summarizeRisk(cap: number) {
  if (cap <= 10) return "High-risk lane";
  if (cap <= 35) return "Aggressive lane";
  if (cap <= 70) return "Balanced lane";
  return "Safer lane";
}

const RECENT_ROLLS = [12, 77, 43, 61, 9];

function getDiceFace(cap: number) {
  if (cap <= 16) return 6;
  if (cap <= 32) return 5;
  if (cap <= 48) return 4;
  if (cap <= 64) return 3;
  if (cap <= 80) return 2;
  return 1;
}

function DicePips({ face }: { face: number }) {
  const cells = Array.from({ length: 9 }, (_, index) => index);
  const active = (() => {
    switch (face) {
      case 1:
        return new Set([4]);
      case 2:
        return new Set([2, 6]);
      case 3:
        return new Set([2, 4, 6]);
      case 4:
        return new Set([0, 2, 6, 8]);
      case 5:
        return new Set([0, 2, 4, 6, 8]);
      default:
        return new Set([0, 2, 3, 5, 6, 8]);
    }
  })();

  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-3 p-5 md:gap-4 md:p-7">
      {cells.map((cell) => (
        <div key={cell} className="flex items-center justify-center">
          {active.has(cell) ? (
            <div className="h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.95)] md:h-5 md:w-5" />
          ) : null}
        </div>
      ))}
    </div>
  );
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
    variant = "default"
  } = props;
  const capNumber = Number(cap) || 0;
  const riskLabel = summarizeRisk(capNumber);
  const progressPct = Math.max(2, Math.min(98, capNumber));
  const isPrototypeVariant = variant === "prototype";
  const diceFace = getDiceFace(progressPct);

  if (isPrototypeVariant) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="relative min-h-[640px] overflow-hidden rounded-[2.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,24,0.98),rgba(4,7,13,0.98))] px-5 pb-8 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[24%] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-purple-600/15 blur-[90px]" />
            <div className="absolute left-1/2 top-[42%] h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/8 blur-[80px]" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_top,black,transparent)]" />
          </div>

          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recent room rolls
                </div>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                {RECENT_ROLLS.map((value) => (
                  <span
                    key={value}
                    className={cn(
                      "inline-flex h-10 min-w-12 items-center justify-center rounded-xl border px-3 font-mono text-sm font-bold",
                      value <= progressPct
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-400/20 bg-rose-500/10 text-rose-300"
                    )}
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center pb-44 pt-10 md:pb-48">
              <div className="relative">
                <div className="absolute inset-0 translate-y-10 rounded-full bg-black/70 blur-[44px]" />
                <div className="relative h-44 w-44 [perspective:1000px] md:h-56 md:w-56">
                  <div className="absolute inset-4 rounded-[2rem] bg-purple-950/40 blur-2xl" />
                  <div className="absolute inset-0 rotate-[-8deg] rounded-[2.2rem] bg-[#1a1030] shadow-[0_30px_70px_rgba(0,0,0,0.55)]" />
                  <div className="absolute inset-0 rotate-[9deg] rounded-[2.2rem] bg-[#12192d]" />
                  <div className="absolute inset-0 rounded-[2.2rem] border border-violet-300/30 bg-[linear-gradient(180deg,rgba(126,34,206,0.88),rgba(76,29,149,0.94))] shadow-[inset_0_0_40px_rgba(0,0,0,0.5),0_20px_60px_rgba(76,29,149,0.35)]">
                    <DicePips face={diceFace} />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mx-auto w-full max-w-4xl rounded-[2rem] border border-white/10 bg-[#05070d]/90 p-5 shadow-[0_32px_80px_rgba(2,6,23,0.52)] backdrop-blur-2xl md:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Hit under
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-5xl font-black tracking-[-0.08em] text-white">{cap}</span>
                    <span className="pb-1 text-xl font-semibold text-slate-400">%</span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-300">{riskLabel}</div>
                </div>

                <div className="rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
                  0 to {cap} window
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="relative h-16">
                  <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 shadow-[inset_0_4px_12px_rgba(0,0,0,0.75)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(248,113,113,0.95),rgba(236,72,153,0.98),rgba(139,92,246,0.95))]"
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
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
                  />
                  <div
                    className="absolute top-1/2 z-10 -ml-6 -translate-y-1/2"
                    style={{ left: `${progressPct}%` }}
                  >
                    <div className="rounded-2xl border border-violet-300/30 bg-violet-600 px-3 py-1.5 font-mono text-lg font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.45)]">
                      {cap}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Riskier lane</span>
                  <span>Safer lane</span>
                </div>

                {presets.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={disabled}
                        onClick={() => onCapChange?.(String(preset))}
                        className={cn(
                          "rounded-[1rem] border px-4 py-3 text-left transition-all duration-200",
                          cap === String(preset)
                            ? "border-violet-300/70 bg-violet-500/20 text-white shadow-[0_16px_32px_rgba(124,58,237,0.24)]"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
                        )}
                      >
                        <div className="text-xl font-black tracking-[-0.04em]">{preset}%</div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {summarizeRisk(preset)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Dice lane
        </div>
        <div className="text-2xl font-black tracking-tight text-white">{title}</div>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>

      <div className="rounded-[1.9rem] border border-violet-400/15 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_24%),radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_38%),linear-gradient(180deg,rgba(30,14,49,0.96),rgba(8,12,24,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-5 rounded-[1.75rem] border border-fuchsia-300/10 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.2),transparent_32%),linear-gradient(180deg,rgba(31,12,48,0.92),rgba(10,15,28,0.98))] px-6 py-6 text-center shadow-[0_24px_70px_rgba(76,29,149,0.18)]">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Hit under
            </Label>

            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(76,29,149,0.34),rgba(15,23,42,0.84))] shadow-[0_0_0_14px_rgba(15,23,42,0.55)]">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Win chance
                </div>
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
              Lower caps are harder to hit and push the payout higher. Lock the lane here, then size
              the ticket on the right.
            </p>
          </div>

          <div className="space-y-5 rounded-[1.75rem] border border-fuchsia-300/10 bg-slate-950/35 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Choose your lane
                </div>
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
                { label: "Next step", value: "Size ticket" }
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {item.label}
                  </div>
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
