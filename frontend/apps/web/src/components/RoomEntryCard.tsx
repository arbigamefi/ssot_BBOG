"use client";

import Link from "next/link";
import * as React from "react";
import { PlayCircleIcon } from "@heroicons/react/24/outline";

import { cn } from "@ssot/ui";

type Accent = "blue" | "emerald" | "amber" | "fuchsia" | "slate";

const ACCENT_CLASSES: Record<
  Accent,
  {
    badge: string;
    surface: string;
    border: string;
    action: string;
    glow: string;
    meta: string;
    headline: string;
  }
> = {
  blue: {
    badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
    surface:
      "bg-[linear-gradient(160deg,rgba(5,10,22,0.96),rgba(7,12,24,0.82)),radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_42%)]",
    border: "border-cyan-400/14 hover:border-cyan-300/28",
    action: "border-cyan-300/20 bg-cyan-400/12 text-cyan-100 hover:bg-cyan-400/18",
    glow: "hover:shadow-[0_28px_80px_rgba(8,47,73,0.42)]",
    meta: "border-cyan-400/30 text-cyan-200",
    headline: "from-white to-cyan-200"
  },
  emerald: {
    badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    surface:
      "bg-[linear-gradient(160deg,rgba(5,10,22,0.96),rgba(7,12,24,0.82)),radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_42%)]",
    border: "border-emerald-400/14 hover:border-emerald-300/28",
    action: "border-emerald-300/20 bg-emerald-400/12 text-emerald-100 hover:bg-emerald-400/18",
    glow: "hover:shadow-[0_28px_80px_rgba(6,78,59,0.42)]",
    meta: "border-emerald-400/30 text-emerald-200",
    headline: "from-white to-emerald-200"
  },
  amber: {
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    surface:
      "bg-[linear-gradient(160deg,rgba(5,10,22,0.96),rgba(7,12,24,0.82)),radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_42%)]",
    border: "border-amber-400/14 hover:border-amber-300/28",
    action: "border-amber-300/20 bg-amber-400/12 text-amber-100 hover:bg-amber-400/18",
    glow: "hover:shadow-[0_28px_80px_rgba(120,53,15,0.42)]",
    meta: "border-amber-400/30 text-amber-200",
    headline: "from-white to-amber-200"
  },
  fuchsia: {
    badge: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100",
    surface:
      "bg-[linear-gradient(160deg,rgba(5,10,22,0.96),rgba(7,12,24,0.82)),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_42%)]",
    border: "border-fuchsia-400/14 hover:border-fuchsia-300/28",
    action: "border-fuchsia-300/20 bg-fuchsia-400/12 text-fuchsia-100 hover:bg-fuchsia-400/18",
    glow: "hover:shadow-[0_28px_80px_rgba(112,26,117,0.42)]",
    meta: "border-fuchsia-400/30 text-fuchsia-200",
    headline: "from-white to-fuchsia-200"
  },
  slate: {
    badge: "border-white/12 bg-white/[0.06] text-white/72",
    surface:
      "bg-[linear-gradient(160deg,rgba(5,10,22,0.96),rgba(7,12,24,0.82)),radial-gradient(circle_at_top_right,rgba(148,163,184,0.12),transparent_42%)]",
    border: "border-white/10 hover:border-white/18",
    action: "border-white/14 bg-white/[0.06] text-white/88 hover:bg-white/[0.1]",
    glow: "hover:shadow-[0_28px_80px_rgba(15,23,42,0.42)]",
    meta: "border-white/12 text-white/72",
    headline: "from-white to-white/72"
  }
};

export function RoomEntryCard({
  slug,
  href,
  title,
  summary,
  badge,
  meta,
  facts,
  accent = "slate",
  icon,
  featured = false,
  actionLabel = "Enter Module"
}: {
  slug: string;
  href: string;
  title: string;
  summary: string;
  badge: string;
  meta?: string;
  facts?: string[];
  accent?: Accent;
  icon?: React.ReactNode;
  featured?: boolean;
  actionLabel?: string;
}) {
  const accentClasses = ACCENT_CLASSES[accent];

  return (
    <Link
      href={href}
      data-testid="room-entry-card"
      data-slug={slug}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[2rem] border transition-all duration-300 shadow-[inset_0_2px_15px_rgba(255,255,255,0.02),0_20px_40px_rgba(0,0,0,0.8)]",
        accentClasses.surface,
        accentClasses.border,
        accentClasses.glow,
        featured ? "min-h-[360px] md:min-h-[400px]" : "min-h-[360px]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="pointer-events-none absolute top-5 left-5 right-5 z-20 flex items-start justify-between gap-4">
        <div
          className={cn(
            "rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] backdrop-blur-md",
            accentClasses.badge
          )}
        >
          {badge}
        </div>
        {meta ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-[#020202]/90 px-3 py-1.5 shadow-[inset_0_2px_5px_rgba(255,255,255,0.06)] backdrop-blur-md",
              accentClasses.meta
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
            <span className="text-xs font-mono font-bold tracking-widest text-white">{meta}</span>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-10 flex flex-1 items-center justify-center p-6 transition-transform duration-500 group-hover:scale-105">
        {icon ? <div className="text-4xl opacity-95">{icon}</div> : null}
      </div>

      <div className="relative z-20 border-t border-white/10 bg-[#0a0a0a]/90 p-6 pt-8 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] backdrop-blur-xl">
        <div className={cn("space-y-4", featured ? "max-w-[34rem]" : "max-w-[24rem]")}>
          <div
            className={cn(
              "bg-gradient-to-r bg-clip-text text-2xl font-extrabold tracking-tight text-transparent md:text-3xl",
              accentClasses.headline
            )}
          >
            {title}
          </div>
          <p className="min-h-10 text-sm leading-7 text-white/40 md:text-[15px]">{summary}</p>
        </div>

        {facts && facts.length ? (
          <div className="mt-6 grid gap-2">
            {facts.slice(0, 2).map((fact) => (
              <div key={fact} className="text-[11px] font-medium text-white/36">
                {fact}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6">
          <div
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#050505] px-4 py-4 text-sm font-semibold text-white/80 transition-all shadow-[inset_0_2px_5px_rgba(255,255,255,0.08)]",
              accentClasses.action
            )}
          >
            {actionLabel}
            <PlayCircleIcon className="h-5 w-5 flex-shrink-0" />
          </div>
        </div>
      </div>
    </Link>
  );
}
