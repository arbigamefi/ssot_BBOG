import * as React from "react";

import { shortHex } from "./format";

export function PortfolioContextCard({
  readOnly,
  releaseName,
  releaseDigest
}: {
  readOnly: boolean;
  releaseName?: string;
  releaseDigest?: string;
}) {
  const rows = [
    { label: "Session", value: readOnly ? "Read-only" : "Writable" },
    { label: "Network", value: releaseName ?? "Unknown" },
    { label: "Digest", value: shortHex(releaseDigest) }
  ];

  return (
    <section className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
        Execution context
      </div>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-0 px-4 py-3 text-sm"
          >
            <span className="font-bold text-fg-muted">{row.label}</span>
            <span className="font-mono text-fg">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
