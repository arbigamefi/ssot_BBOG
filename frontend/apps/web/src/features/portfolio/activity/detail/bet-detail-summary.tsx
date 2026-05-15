import * as React from "react";

import type { BetDetailMetric } from "./types";

export function BetDetailSummary({ metrics }: { metrics: readonly BetDetailMetric[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-md border border-border bg-surface-1 p-5 shadow-e2"
        >
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
            {metric.label}
          </div>
          <div className={`mt-3 font-mono text-xl font-black ${metricTone(metric.tone)}`}>
            {metric.value}
          </div>
          <div className="mt-2 text-xs leading-5 text-fg-muted">{metric.detail}</div>
        </div>
      ))}
    </section>
  );
}

function metricTone(tone: BetDetailMetric["tone"]) {
  if (tone === "success") return "text-success";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-fg";
}
