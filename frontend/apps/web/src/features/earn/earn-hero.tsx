import * as React from "react";
import { useTranslations } from "next-intl";
import { CircleStackIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

import type { EarnMetric } from "./types";

export function EarnHero({
  symbol,
  bankAddress,
  metrics
}: {
  symbol: string;
  bankAddress: string;
  metrics: readonly EarnMetric[];
}) {
  const t = useTranslations();

  return (
    <section className="grid gap-8 border-b border-border-soft pb-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.7fr)] lg:items-end">
      <div>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-accent">
          <CircleStackIcon className="h-4 w-4" />
          {t("earn.hero.eyebrow")}
        </div>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-normal text-fg md:text-6xl">
          {t("earn.hero.title", { symbol })}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-fg-muted">
          {t("earn.hero.description")}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-fg-subtle">
          {t("earn.hero.disclosure")}
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface-1/80">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {t("earn.hero.bankAddress")}
            </div>
            <div className="mt-1 truncate font-mono text-sm text-fg-muted" title={bankAddress}>
              {bankAddress}
            </div>
          </div>
          <ShieldCheckIcon className="h-6 w-6 text-brand" />
        </div>
        <dl className="divide-y divide-border-soft">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <dt className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                  {metric.label}
                </div>
                <div className="mt-1 text-sm leading-5 text-fg-muted">{metric.detail}</div>
              </dt>
              <dd
                className="truncate font-mono text-xl font-bold text-fg sm:max-w-[14rem] sm:text-right"
                title={metric.value}
              >
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
