import * as React from "react";

import type { LandingStat } from "./home-types";

export function HomeStatsStrip({ stats }: { stats: readonly LandingStat[] }) {
  return (
    <section className="border-b border-border bg-surface-1">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-border px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10">
        {stats.map((stat) => (
          <div key={stat.label} className="py-6 md:px-8">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
              {stat.label}
            </div>
            <div className="mt-2 font-mono text-3xl font-black text-fg">{stat.value}</div>
            <div className="mt-2 text-sm text-fg-muted">{stat.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
