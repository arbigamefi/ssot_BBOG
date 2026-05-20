import * as React from "react";

import { toneBadgeClass } from "./format";
import type { OpsTrailRow } from "./types";

export type OpsEventTrailCopy = {
  eyebrow: string;
  title: string;
  description: string;
  headers: {
    timeBlock: string;
    event: string;
    status: string;
    context: string;
    flow: string;
  };
  flowLabel: string;
  mobileBlockLabel: string;
};

export function OpsEventTrail({
  rows,
  copy
}: {
  rows: readonly OpsTrailRow[];
  copy: OpsEventTrailCopy;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border px-5 py-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          {copy.eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{copy.description}</p>
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[1.1fr_1.1fr_1fr_1.3fr_80px] border-b border-border bg-surface-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
          <div>{copy.headers.timeBlock}</div>
          <div>{copy.headers.event}</div>
          <div>{copy.headers.status}</div>
          <div>{copy.headers.context}</div>
          <div className="text-right">{copy.headers.flow}</div>
        </div>
        {rows.map((row) => (
          <div
            key={`${row.time}-${row.event}`}
            className="grid grid-cols-[1.1fr_1.1fr_1fr_1.3fr_80px] items-center border-b border-border-soft px-5 py-4 text-sm last:border-b-0"
          >
            <div>
              <div className="font-bold text-fg">{row.time}</div>
              <div className="mt-1 font-mono text-xs text-fg-subtle">{row.block}</div>
            </div>
            <div className="font-bold text-fg-muted">{row.event}</div>
            <div>
              <StatusBadge row={row} />
            </div>
            <div className="text-fg-muted">{row.context}</div>
            <div className="text-right text-xs font-black uppercase tracking-[0.12em] text-brand">
              {copy.flowLabel}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {rows.map((row) => (
          <div
            key={`${row.time}-${row.event}`}
            className="rounded-md border border-border-soft bg-surface-0 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-fg">{row.event}</div>
                <div className="mt-1 font-mono text-xs text-fg-subtle">{row.time}</div>
              </div>
              <StatusBadge row={row} />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-fg-subtle">{copy.mobileBlockLabel}</span>
                <span className="font-mono text-fg-muted">{row.block}</span>
              </div>
              <div className="text-fg-muted">{row.context}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ row }: { row: OpsTrailRow }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneBadgeClass(row.tone)}`}
    >
      {row.status}
    </span>
  );
}
