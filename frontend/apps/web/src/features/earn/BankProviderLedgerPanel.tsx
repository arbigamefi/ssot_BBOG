"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { formatTokenAmount, shortHex } from "./format";
import type { EarnProviderLedgerEntry } from "./types";

function sumAssets(
  entries: readonly EarnProviderLedgerEntry[],
  action: EarnProviderLedgerEntry["action"]
) {
  return entries.reduce((acc, row) => (row.action === action ? acc + (row.assets ?? 0n) : acc), 0n);
}

function formatSignedToken(value: bigint, decimals: number, symbol: string) {
  if (value < 0n) return `−${formatTokenAmount(-value, decimals, symbol, 2)}`;
  return formatTokenAmount(value, decimals, symbol, 2);
}

function formatTime(value: number | undefined, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function BankProviderLedgerPanel({
  connected,
  decimals,
  entries,
  error,
  explorerBaseUrl,
  hasMore = false,
  loading,
  loadingMore = false,
  onLoadMore,
  positionAssets,
  positionShares,
  symbol
}: {
  connected: boolean;
  decimals: number;
  entries: readonly EarnProviderLedgerEntry[];
  error?: string;
  explorerBaseUrl?: string;
  hasMore?: boolean;
  loading: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  positionAssets?: bigint;
  positionShares?: bigint;
  symbol: string;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const deposited = sumAssets(entries, "deposit");
  const withdrawn = sumAssets(entries, "withdraw");
  const openValue = positionAssets ?? 0n;
  const netPnl = withdrawn + openValue - deposited;
  const hasCompleteAssetRows = entries.every((entry) => entry.assets != null);

  const summaryVisible = connected && !loading && !error;
  const summary = [
    {
      key: "deposited",
      label: t("earn.ledger.summary.deposited"),
      value: formatTokenAmount(deposited, decimals, symbol, 2)
    },
    {
      key: "withdrawn",
      label: t("earn.ledger.summary.withdrawn"),
      value: formatTokenAmount(withdrawn, decimals, symbol, 2)
    },
    {
      key: "openValue",
      label: t("earn.ledger.summary.openValue"),
      value: formatTokenAmount(positionAssets, decimals, symbol, 2)
    },
    {
      key: "netPnl",
      label: t("earn.ledger.summary.netPnl"),
      value:
        hasCompleteAssetRows && positionAssets != null
          ? formatSignedToken(netPnl, decimals, symbol)
          : "—",
      tone: netPnl >= 0n ? "win" : "loss"
    },
    {
      key: "shares",
      label: t("earn.ledger.summary.shares"),
      value: formatTokenAmount(positionShares, decimals, undefined, 4)
    }
  ];

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
            {t("earn.ledger.eyebrow")}
          </div>
          <h2 className="mt-1 text-lg font-bold text-fg">{t("earn.ledger.title")}</h2>
        </div>
        <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-success">
          {t("earn.ledger.readModel")}
        </span>
      </div>

      <div className="grid divide-y divide-border-soft border-b border-border-soft sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        {summary.map((item) => (
          <div key={item.key} className="min-w-0 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
              {item.label}
            </div>
            <div
              className={cn(
                "mt-1 truncate font-mono text-sm font-bold text-fg",
                summaryVisible && item.tone === "win" && "text-success",
                summaryVisible && item.tone === "loss" && "text-danger"
              )}
              title={summaryVisible ? item.value : undefined}
            >
              {summaryVisible ? item.value : "—"}
            </div>
          </div>
        ))}
      </div>

      {!connected ? (
        <div className="px-5 py-8 text-sm text-fg-muted">{t("earn.ledger.connectWallet")}</div>
      ) : loading ? (
        <div className="px-5 py-8 text-sm text-fg-muted">{t("earn.ledger.loading")}</div>
      ) : error ? (
        <div className="px-5 py-8 text-sm text-danger">{error}</div>
      ) : entries.length === 0 ? (
        <div className="px-5 py-8 text-sm text-fg-muted">{t("earn.ledger.empty")}</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[110px_minmax(150px,1fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_110px] border-b border-border-soft bg-surface-0 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
              <div>{t("earn.ledger.columns.type")}</div>
              <div>{t("earn.ledger.columns.time")}</div>
              <div className="text-right">{t("earn.ledger.columns.assets")}</div>
              <div className="text-right">{t("earn.ledger.columns.shares")}</div>
              <div className="text-right">{t("earn.ledger.columns.sharePrice")}</div>
              <div className="text-right">{t("earn.ledger.columns.tx")}</div>
            </div>
            {entries.map((entry) => {
              const actionLabel = t(`earn.ledger.actions.${entry.action}`);
              const tx = shortHex(entry.txHash);
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-[110px_minmax(150px,1fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_110px] items-center border-b border-border-soft px-5 py-4 text-sm last:border-b-0"
                >
                  <div
                    className={cn(
                      "w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                      entry.action === "deposit"
                        ? "border-success/30 bg-success-soft text-success"
                        : "border-brand/30 bg-brand-soft text-brand"
                    )}
                  >
                    {actionLabel}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-fg">{formatTime(entry.timestamp, locale)}</div>
                    <div className="mt-1 font-mono text-[11px] text-fg-subtle">
                      {t("earn.ledger.block", { blockNumber: entry.blockNumber })}
                    </div>
                  </div>
                  <div className="truncate text-right font-mono font-bold text-fg">
                    {formatTokenAmount(entry.assets, decimals, symbol, 4)}
                  </div>
                  <div className="truncate text-right font-mono text-fg">
                    {formatTokenAmount(entry.shares, decimals, undefined, 4)}
                  </div>
                  <div className="truncate text-right font-mono text-fg">
                    {formatTokenAmount(entry.sharePrice, decimals, symbol, 6)}
                  </div>
                  <div className="text-right font-mono text-xs">
                    {explorerBaseUrl ? (
                      <a
                        href={`${explorerBaseUrl}/tx/${entry.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:text-brand-hover"
                      >
                        {tx}
                      </a>
                    ) : (
                      <span className="text-fg-muted">{tx}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 px-5 py-4 text-xs text-fg-muted">
              <span>{t("earn.ledger.loadedRows", { count: entries.length })}</span>
              {hasMore ? (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="rounded-md border border-border bg-surface-1 px-3 py-2 font-bold uppercase tracking-[0.12em] text-fg transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMore ? t("earn.ledger.loadingMore") : t("earn.ledger.loadMore")}
                </button>
              ) : (
                <span>{t("earn.ledger.end")}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="border-t border-border-soft px-5 py-4 text-[10px] leading-4 text-fg-subtle">
        {t("earn.ledger.note")}
      </p>
    </section>
  );
}
