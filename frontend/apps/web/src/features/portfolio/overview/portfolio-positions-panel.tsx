import * as React from "react";
import { useTranslations } from "next-intl";

import { formatAllowance, formatAmount } from "./format";
import type { PortfolioAssetRow } from "./types";

export function PortfolioPositionsPanel({
  rows,
  loading
}: {
  rows: readonly PortfolioAssetRow[];
  loading: boolean;
}) {
  const t = useTranslations();
  const pendingLabel = t("portfolio.overview.common.pending");

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border px-5 py-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          {t("portfolio.overview.positions.eyebrow")}
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">
          {t("portfolio.overview.positions.title")}
        </h2>
      </div>

      <div className="overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] border-b border-border bg-surface-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
          <div>{t("portfolio.overview.positions.columns.asset")}</div>
          <div>{t("portfolio.overview.positions.columns.wallet")}</div>
          <div>{t("portfolio.overview.positions.columns.bankPosition")}</div>
          <div>{t("portfolio.overview.positions.columns.allowance")}</div>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-fg-muted">
            {t("portfolio.overview.positions.loading")}
          </div>
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center border-b border-border-soft px-5 py-4 text-sm last:border-b-0"
            >
              <div>
                <div className="font-mono font-black text-fg">{row.symbol}</div>
                <div className="mt-1 font-mono text-xs text-fg-subtle">{row.asset}</div>
              </div>
              <div className="font-mono text-fg-muted">
                {formatAmount(row.walletBalance, row.decimals, undefined, pendingLabel)}
              </div>
              <div>
                <div className="font-mono font-bold text-fg">
                  {formatAmount(row.assetsEquivalent, row.decimals, undefined, pendingLabel)}
                </div>
                <div className="mt-1 font-mono text-xs text-fg-subtle">
                  {t("portfolio.overview.positions.shares", {
                    amount: formatAmount(row.shares, row.decimals, undefined, pendingLabel)
                  })}
                </div>
              </div>
              <div
                className={
                  row.allowance === 0n
                    ? "font-mono font-bold text-danger"
                    : "font-mono font-bold text-success"
                }
              >
                {formatAllowance(
                  row.allowance,
                  row.decimals,
                  t("portfolio.overview.common.unlimited"),
                  pendingLabel
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-12 text-center text-sm text-fg-muted">
            {t("portfolio.overview.common.connectWalletInspect")}
          </div>
        )}
      </div>
    </section>
  );
}
