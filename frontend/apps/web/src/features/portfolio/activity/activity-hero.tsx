import * as React from "react";
import { ClipboardDocumentListIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

import type { BetMetric } from "./types";

export function ActivityHero({ metrics }: { metrics: readonly BetMetric[] }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-accent">
          <ClipboardDocumentListIcon className="h-4 w-4" />
          Activity ledger
        </div>
        <h1 className="max-w-3xl text-4xl font-black tracking-tight text-fg md:text-5xl">
          Betting activity.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-fg-muted">
          Review indexed tickets, settlement state, and capital outcomes without mixing detail
          actions into the activity surface.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
              Ledger summary
            </div>
            <div className="mt-2 text-sm text-fg-muted">Indexed browser session</div>
          </div>
          <div className="rounded-md border border-border bg-surface-2 p-3 text-accent">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-border-soft bg-surface-0 p-4"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
                {metric.label}
              </div>
              <div className="mt-2 font-mono text-xl font-black text-fg">{metric.value}</div>
              <div className="mt-1 text-xs leading-5 text-fg-muted">{metric.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
