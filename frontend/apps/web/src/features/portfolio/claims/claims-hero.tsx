import * as React from "react";
import { useTranslations } from "next-intl";
import { BanknotesIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

import type { ClaimsMetric } from "./types";

export function ClaimsHero({
  wallet,
  metrics
}: {
  wallet?: string;
  metrics: readonly ClaimsMetric[];
}) {
  const t = useTranslations();

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
      <div>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-accent">
          <BanknotesIcon className="h-4 w-4" />
          {t("portfolio.claims.hero.eyebrow")}
        </div>
        <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-normal text-fg md:text-6xl">
          {t("portfolio.claims.hero.title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-fg-muted">
          {t("portfolio.claims.hero.description")}
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface-1 shadow-e2">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
              {t("portfolio.claims.hero.connectedPayee")}
            </div>
            <div className="mt-1 font-mono text-sm text-fg-muted">
              {wallet ?? t("portfolio.claims.common.walletRequired")}
            </div>
          </div>
          <ShieldCheckIcon className="h-6 w-6 text-brand" />
        </div>
        <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {metrics.map((metric) => (
            <div key={metric.label} className="p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
                {metric.label}
              </div>
              <div className="mt-2 font-mono text-2xl font-black text-fg">{metric.value}</div>
              <div className="mt-2 text-sm leading-5 text-fg-muted">{metric.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
