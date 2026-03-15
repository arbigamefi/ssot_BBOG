"use client";

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
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Call the flip</div>
        <div className="text-2xl font-black tracking-tight text-white">{title}</div>
        {description ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>

      <div className="rounded-[1.9rem] border border-violet-400/15 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_24%),radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_38%),linear-gradient(180deg,rgba(30,14,49,0.96),rgba(8,12,24,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-5 rounded-[1.75rem] border border-fuchsia-300/10 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.16),transparent_32%),linear-gradient(180deg,rgba(31,12,48,0.92),rgba(10,15,28,0.98))] px-6 py-6 text-center shadow-[0_24px_70px_rgba(120,53,15,0.18)]">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected face</div>
            <div className="flex h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(250,204,21,0.35),rgba(82,38,10,0.82))] shadow-[0_0_0_14px_rgba(15,23,42,0.55)]">
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/75">Live call</div>
                <div className="mt-3 text-5xl font-black text-white">{side === "heads" ? "H" : "T"}</div>
              </div>
            </div>
            <div className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
              {side === "heads" ? "Heads locked" : "Tails locked"}
            </div>
            <p className="max-w-[16rem] text-sm leading-6 text-slate-400">
              One face, one ticket, one reveal. Call the flip here, then size the stake on the right.
            </p>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-fuchsia-300/10 bg-slate-950/35 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Choose the face</div>
                <div className="text-sm font-semibold text-white">{side === "heads" ? "Heads" : "Tails"} is active</div>
              </div>
              <div className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                Binary pick
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                className={cn(
                  "relative overflow-hidden rounded-[1.75rem] border p-6 text-left transition-all duration-200",
                  side === "heads"
                    ? "border-amber-300/70 bg-amber-400/15 text-white shadow-[0_24px_60px_rgba(217,119,6,0.18)]"
                    : "border-slate-800 bg-slate-950/45 text-slate-300 hover:border-slate-600 hover:text-white"
                )}
                disabled={disabled}
                onClick={() => onSideChange?.("heads")}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Face A</div>
                    <div className="mt-3 text-4xl font-black tracking-tight">Heads</div>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-black">
                    H
                  </div>
                </div>
                <div className="mt-4 text-sm leading-6 text-slate-400">Cleanest call if you want the ticket to read like a simple yes/no slip.</div>
              </button>

              <button
                type="button"
                className={cn(
                  "relative overflow-hidden rounded-[1.75rem] border p-6 text-left transition-all duration-200",
                  side === "tails"
                    ? "border-fuchsia-300/70 bg-fuchsia-400/15 text-white shadow-[0_24px_60px_rgba(192,38,211,0.18)]"
                    : "border-slate-800 bg-slate-950/45 text-slate-300 hover:border-slate-600 hover:text-white"
                )}
                disabled={disabled}
                onClick={() => onSideChange?.("tails")}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Face B</div>
                    <div className="mt-3 text-4xl font-black tracking-tight">Tails</div>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-black">
                    T
                  </div>
                </div>
                <div className="mt-4 text-sm leading-6 text-slate-400">Same execution path, different face. Pick the side you want the reveal to land on.</div>
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Now locked</div>
                <div className="mt-1 text-sm font-semibold text-white">{side === "heads" ? "Heads" : "Tails"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next step</div>
                <div className="mt-1 text-sm font-semibold text-white">Size ticket</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-rose-300">{error}</p> : null}
    </div>
  );
}
