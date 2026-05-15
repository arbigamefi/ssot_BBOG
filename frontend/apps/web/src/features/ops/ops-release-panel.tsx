import * as React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

import type { OpsKeyValueRow } from "./types";

export function OpsReleasePanel({
  rows,
  onSync,
  onRefresh
}: {
  rows: readonly OpsKeyValueRow[];
  onSync: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
            Release bundle
          </div>
          <h2 className="mt-2 text-2xl font-black text-fg">Canonical release proof</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
            The exact chain, contract, and manifest surface currently presented by the frontend.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <OpsButton onClick={onSync}>Sync indexer</OpsButton>
          <OpsButton onClick={onRefresh} subtle>
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </OpsButton>
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border border-border-soft bg-surface-0 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
              {row.label}
            </div>
            <div className="mt-3 break-all font-mono text-sm font-bold text-fg">{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OpsButton({
  children,
  subtle,
  onClick
}: {
  children: React.ReactNode;
  subtle?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        subtle
          ? "inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-fg transition hover:bg-surface-3"
          : "rounded-md bg-brand px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-fg-inverse shadow-glow transition hover:bg-brand-hover"
      }
    >
      {children}
    </button>
  );
}
