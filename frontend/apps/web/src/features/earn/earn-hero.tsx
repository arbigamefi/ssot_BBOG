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
    <section className="grid gap-5 border-b border-border-soft pb-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.7fr)] lg:items-end lg:gap-8 lg:pb-8">
      <div className="min-w-0">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-accent">
          <CircleStackIcon className="h-4 w-4" />
          {t("earn.hero.eyebrow")}
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-normal text-fg md:text-6xl">
          {t("earn.hero.title", { symbol })}
        </h1>

        <div className="mt-5 lg:hidden">
          <BankSnapshot bankAddress={bankAddress} metrics={metrics} />
        </div>

        <p className="mt-5 max-w-2xl text-sm leading-6 text-fg-muted sm:text-base sm:leading-7">
          {t("earn.hero.description")}
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-5 text-fg-subtle sm:text-sm sm:leading-6">
          {t("earn.hero.disclosure")}
        </p>
      </div>

      <div className="hidden lg:block">
        <BankSnapshot bankAddress={bankAddress} metrics={metrics} />
      </div>
    </section>
  );
}

function BankSnapshot({
  bankAddress,
  metrics
}: {
  bankAddress: string;
  metrics: readonly EarnMetric[];
}) {
  const t = useTranslations();

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-1/80">
      <div className="flex items-center justify-between gap-4 border-b border-border-soft px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
            {t("earn.hero.bankAddress")}
          </div>
          <div className="mt-1 truncate font-mono text-sm text-fg-muted" title={bankAddress}>
            {bankAddress}
          </div>
        </div>
        <ShieldCheckIcon className="h-6 w-6 shrink-0 text-brand" />
      </div>

      <dl className="grid grid-cols-2 gap-px bg-border-soft">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 bg-surface-1/80 px-3 py-3 sm:px-4">
            <dt
              className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-fg-subtle"
              title={metric.label}
            >
              {metric.label}
            </dt>
            <dd
              className="mt-2 truncate font-mono text-sm font-bold text-fg sm:text-base"
              title={`${metric.label}: ${metric.value}. ${metric.detail}`}
            >
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
