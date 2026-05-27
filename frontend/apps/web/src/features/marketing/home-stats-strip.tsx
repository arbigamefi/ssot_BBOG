import * as React from "react";

import type { LandingStat } from "./home-types";

export function HomeStatsStrip({ stats }: { stats: readonly LandingStat[] }) {
  return (
    <section className="border-b border-border-soft bg-surface-0 py-10">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 px-6 md:grid-cols-3 lg:px-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl border border-border-soft p-6 shadow-e2"
            style={{
              background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
              }}
            />
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
              {stat.label}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold text-fg">{stat.value}</div>
            <div className="mt-2 text-sm text-fg-muted">{stat.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
