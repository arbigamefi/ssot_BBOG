import * as React from "react";
import { cn } from "../../lib/utils";

export type GameCardProps = {
  slug: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  description?: string;
  summary?: string;
  facts?: string[];
  rtp?: string;
  ctaLabel?: string;
  className?: string;
  children?: React.ReactNode;
};

const SLUG_ACCENTS: Record<
  string,
  {
    stage: string;
    pill: string;
  }
> = {
  dice: {
    stage:
      "bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.28),transparent_28%),linear-gradient(145deg,rgba(18,27,62,0.98),rgba(7,11,26,0.98))]",
    pill: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  },
  "coin-toss": {
    stage:
      "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.24),transparent_28%),linear-gradient(145deg,rgba(45,24,6,0.98),rgba(7,11,26,0.98))]",
    pill: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  },
  roulette: {
    stage:
      "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.24),transparent_28%),linear-gradient(145deg,rgba(57,14,33,0.98),rgba(7,11,26,0.98))]",
    pill: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  },
  keno: {
    stage:
      "bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.24),transparent_28%),linear-gradient(145deg,rgba(31,17,63,0.98),rgba(7,11,26,0.98))]",
    pill: "border-violet-300/25 bg-violet-300/10 text-violet-100",
  },
};

export function GameCard({
  slug,
  label,
  icon,
  badge,
  description,
  summary,
  facts,
  rtp,
  ctaLabel = "Enter room",
  className,
}: GameCardProps) {
  const accent = SLUG_ACCENTS[slug] ?? {
    stage:
      "bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.24),transparent_28%),linear-gradient(145deg,rgba(18,27,62,0.98),rgba(7,11,26,0.98))]",
    pill: "border-white/15 bg-white/[0.06] text-slate-100",
  };

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#0a1024]/80 p-3 transition-all duration-300",
        "hover:-translate-y-1 hover:border-white/14 hover:shadow-[0_20px_70px_rgba(2,6,23,0.55)]",
        className
      )}
    >
      <div className={cn("relative overflow-hidden rounded-[1.35rem] border border-white/8 p-4", accent.stage)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />
        <div className="relative flex min-h-[11rem] flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              Room live
            </div>
            {badge ? (
              <div className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", accent.pill)}>
                {badge}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-[1.15rem] border border-white/10 bg-[#050714]/45 text-4xl shadow-lg shadow-black/25">
              {icon}
            </div>
            <div className="max-w-[16rem] text-2xl font-black tracking-tight text-white">{label}</div>
            {description ? <p className="max-w-[18rem] text-sm leading-6 text-slate-300">{description}</p> : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-2 pb-2 pt-4">
        {summary ? <p className="text-sm leading-6 text-slate-400">{summary}</p> : null}

        <div className="flex flex-wrap gap-2">
          {(facts ?? []).slice(0, 3).map((fact, index) => (
            <span
              key={fact}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                index === 0 ? accent.pill : "border-white/10 bg-white/[0.03] text-slate-300"
              )}
            >
              {fact}
            </span>
          ))}
          {rtp ? (
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              {rtp}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/6 pt-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Room entry</div>
            <div className="mt-1 text-sm font-semibold text-white">Open the table</div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10">
            {ctaLabel}
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0-7 7m7-7H3" />
            </svg>
          </div>
        </div>
      </div>
    </article>
  );
}
