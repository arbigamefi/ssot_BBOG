import * as React from "react";

import { toneTextClass } from "./format";
import type { OpsKeyValueRow } from "./types";

export type OpsWorkerPanelCopy = {
  eyebrow: string;
  title: string;
  description: string;
};

export function OpsWorkerPanel({
  rows,
  copy
}: {
  rows: readonly OpsKeyValueRow[];
  copy: OpsWorkerPanelCopy;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border p-5">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          {copy.eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{copy.description}</p>
      </div>

      <div className="grid gap-3 p-5">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border border-border-soft bg-surface-0 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm font-bold text-fg-muted">{row.label}</div>
              <div className={`text-right font-mono text-sm font-black ${toneTextClass(row.tone)}`}>
                {row.value}
              </div>
            </div>
            {row.detail ? (
              <div className="mt-2 text-sm leading-6 text-fg-muted">{row.detail}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
