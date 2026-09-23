import * as React from "react";
import { useTranslations } from "next-intl";

export function PortfolioContextCard({
  readOnly,
  connected,
  releaseName
}: {
  readOnly: boolean;
  connected: boolean;
  releaseName?: string;
}) {
  const t = useTranslations();
  const rows = [
    {
      label: t("portfolio.overview.context.session"),
      value: !connected
        ? t("portfolio.overview.context.disconnected")
        : readOnly
          ? t("portfolio.overview.context.readOnly")
          : t("portfolio.overview.context.writable")
    },
    {
      label: t("portfolio.overview.context.network"),
      value: releaseName ?? t("portfolio.overview.common.unknown")
    }
  ];

  return (
    <section className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
        {t("portfolio.overview.context.title")}
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
