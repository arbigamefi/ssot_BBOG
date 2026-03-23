"use client";

import * as React from "react";

import { cn } from "@ssot/ui";

type TrustStatItem = {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  accent?: "cyan" | "emerald" | "indigo" | "amber" | "slate";
};

const ACCENT_STYLES: Record<NonNullable<TrustStatItem["accent"]>, string> = {
  cyan: "border-cyan-400/16 bg-cyan-400/[0.06] text-cyan-100",
  emerald: "border-emerald-400/16 bg-emerald-400/[0.06] text-emerald-100",
  indigo: "border-indigo-400/16 bg-indigo-400/[0.06] text-indigo-100",
  amber: "border-amber-400/16 bg-amber-400/[0.06] text-amber-100",
  slate: "border-white/8 bg-white/[0.03] text-white"
};

export function TrustStatsStrip({
  items,
  className
}: {
  items: TrustStatItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => {
        const accent = ACCENT_STYLES[item.accent ?? "slate"];
        return (
          <section
            key={item.label}
            className={cn(
              "rounded-[1.75rem] border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl",
              accent
            )}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
              {item.label}
            </div>
            <div className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">
              {item.value}
            </div>
            {item.helper ? (
              <div className="mt-2 text-xs leading-5 text-white/42">{item.helper}</div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
