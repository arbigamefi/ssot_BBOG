import * as React from "react";

import { BET_STATUS_TABS } from "./format";
import type { BetStatusFilter } from "./types";

export function BetsFilterTabs({
  active,
  onChange
}: {
  active: BetStatusFilter;
  onChange: (value: BetStatusFilter) => void;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 p-2 shadow-e2">
      <div className="grid gap-2 sm:grid-cols-4">
        {BET_STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={
              active === tab.key
                ? "rounded-md bg-brand px-4 py-3 text-left text-fg-inverse shadow-glow"
                : "rounded-md px-4 py-3 text-left text-fg-muted transition hover:bg-surface-2 hover:text-fg"
            }
          >
            <div className="text-xs font-black uppercase tracking-[0.14em]">{tab.label}</div>
            <div className="mt-1 text-xs leading-5 opacity-80">{tab.detail}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
