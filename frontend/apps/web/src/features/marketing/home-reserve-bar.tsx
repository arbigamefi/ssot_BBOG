import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, CircleStackIcon } from "@heroicons/react/24/outline";

export function HomeReserveBar({
  freeReserve,
  totalAssets,
  copy
}: {
  freeReserve: string;
  totalAssets: string;
  copy: {
    eyebrow: string;
    free: string;
    total: string;
    verify: string;
  };
}) {
  return (
    <section className="border-b border-border-soft bg-surface-0 py-6">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div
          className="relative overflow-hidden rounded-xl border border-border-soft px-5 py-4 shadow-e2"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
            }}
          />
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
                <CircleStackIcon className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                {copy.eyebrow}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-4 md:flex-row md:justify-end md:gap-10">
              <ReserveMetric label={copy.free} value={freeReserve} />
              <ReserveMetric label={copy.total} value={totalAssets} />
            </div>
            <Link
              href="/earn"
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border-soft bg-surface-0/60 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-fg transition-[transform,border-color,color,box-shadow] hover:border-accent/50 hover:text-accent hover:shadow-e2"
            >
              {copy.verify} <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReserveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{value}</div>
    </div>
  );
}
