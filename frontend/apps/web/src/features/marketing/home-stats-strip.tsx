import * as React from "react";

import type { LandingAssetTab, LandingStat } from "./home-types";

export function HomeStatsStrip({
  stats,
  copy,
  assetTabs = []
}: {
  stats: readonly LandingStat[];
  copy: { verifiable: string; indexed: string; assetContext: string };
  assetTabs?: readonly LandingAssetTab[];
}) {
  return (
    <section className="border-b border-border-soft bg-surface-0 py-10">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        {assetTabs.length > 1 ? (
          <AssetContextTabs tabs={assetTabs} label={copy.assetContext} />
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
                  {stat.label}
                </div>
                {stat.integrity ? <IntegrityBadge integrity={stat.integrity} copy={copy} /> : null}
              </div>
              <div className="mt-2 truncate font-mono text-3xl font-bold text-fg">{stat.value}</div>
              <div className="mt-2 text-sm text-fg-muted">{stat.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AssetContextTabs({ tabs, label }: { tabs: readonly LandingAssetTab[]; label: string }) {
  return (
    <div className="mb-4 flex justify-start md:justify-end">
      <div
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-border-soft bg-surface-1 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={label}
      >
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            aria-pressed={tab.selected}
            onClick={tab.onSelect}
            className={
              tab.selected
                ? "whitespace-nowrap rounded-full bg-fg px-3 py-1.5 text-xs font-bold text-surface-0"
                : "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold text-fg-muted transition-colors hover:text-fg"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Data-honesty marker (GTM integrity red line). Chain-read values get a solid
 * accent "verifiable" badge; index-derived values get a muted "indexed · may
 * lag" badge. The visual distinction is itself a trust signal — verifiable and
 * best-effort data must never look the same.
 */
function IntegrityBadge({
  integrity,
  copy
}: {
  integrity: "verifiable" | "indexed";
  copy: { verifiable: string; indexed: string };
}) {
  if (integrity === "verifiable") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {copy.verifiable}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-border-soft bg-surface-0/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-fg-subtle">
      {copy.indexed}
    </span>
  );
}
