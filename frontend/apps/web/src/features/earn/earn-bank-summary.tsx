import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";

import { formatBps, formatPctFromBps, formatTokenAmount, shortHex } from "./format";
import type { EarnBankData } from "./types";

export function EarnBankSummary({
  data,
  decimals,
  symbol,
  loading,
  error,
  embedded = false
}: {
  data?: EarnBankData;
  decimals: number;
  symbol: string;
  loading: boolean;
  error?: string;
  embedded?: boolean;
}) {
  const t = useTranslations();
  const snapshot = data?.snapshot;
  const position = data?.position;
  const riskReserveBps = snapshot?.riskReserveBps;
  const riskReserve = snapshot?.riskReserve;
  const freeReserve = snapshot
    ? snapshot.totalAssets > snapshot.activeReserved
      ? snapshot.totalAssets - snapshot.activeReserved
      : 0n
    : undefined;

  const rows = (
    <div className="divide-y divide-border-soft">
      <LedgerRow
        label={t("earn.summary.sharePrice.label")}
        value={formatTokenAmount(snapshot?.assetsPerShare, decimals, symbol, 4)}
        detail={t("earn.async.shareUnitDetail")}
      />
      <LedgerRow
        label={t("earn.summary.totalShares.label")}
        value={formatTokenAmount(snapshot?.totalSupply, decimals, undefined, 2)}
        detail={t("earn.summary.totalShares.detail")}
      />
      <LedgerRow
        icon={<ChartBarIcon className="h-5 w-5" />}
        label={t("earn.summary.capitalPosture.totalAssets")}
        value={formatTokenAmount(snapshot?.totalAssets, decimals, symbol, 2)}
        detail={
          loading
            ? t("earn.summary.capitalPosture.loading")
            : error
              ? error
              : t("earn.summary.capitalPosture.detail")
        }
      />
      <LedgerRow
        label={t("earn.summary.freeReserve.label")}
        value={formatTokenAmount(freeReserve, decimals, symbol, 2)}
        detail={t("earn.summary.freeReserve.detail")}
      />
      <LedgerRow
        label={t("earn.summary.reserved.label")}
        value={formatTokenAmount(snapshot?.activeReserved, decimals, symbol, 2)}
        detail={t("earn.summary.reserved.detail", {
          freeReserve: formatTokenAmount(freeReserve, decimals, symbol, 2),
          riskReserve: formatTokenAmount(riskReserve, decimals, symbol, 2)
        })}
      />
      <LedgerRow
        icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
        label={t("earn.async.totalEquity")}
        value={formatTokenAmount(position?.activeAndClaimableAssets, decimals, symbol, 6)}
        detail={t("earn.async.totalEquityDetail")}
      />
      <>
        <LedgerRow
          label={t("earn.async.walletEquity")}
          value={`${formatTokenAmount(position?.shares, decimals, undefined, 6)} / ${formatTokenAmount(position?.assetsEquivalent, decimals, symbol, 6)}`}
          detail={t("earn.async.depositTerms")}
        />
        <LedgerRow
          label={t("earn.async.queuedEquity")}
          value={`${formatTokenAmount(position?.queuedShares, decimals, undefined, 6)} / ${formatTokenAmount(position?.queuedLiquidAssets, decimals, symbol, 6)}`}
          detail={t("earn.async.queuedDetail")}
        />
        <LedgerRow
          label={t("earn.async.claimableEquity")}
          value={formatTokenAmount(position?.claimableAssets, decimals, symbol, 6)}
          detail={t("earn.async.claimDetail")}
        />
      </>
      <LedgerRow
        icon={<InformationCircleIcon className="h-5 w-5" />}
        label={t("earn.summary.liquidity.label")}
        value={formatPctFromBps(riskReserveBps)}
        detail={t("earn.summary.liquidity.detail", {
          floor: formatBps(riskReserveBps),
          bank: shortHex(snapshot?.bank)
        })}
      />
    </div>
  );

  if (embedded) return rows;

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-bold text-fg">
          <ChartBarIcon className="h-5 w-5 text-brand" />
          {t("earn.summary.capitalPosture.title")}
        </div>
        <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-success">
          {t("earn.summary.capitalPosture.readModel")}
        </span>
      </div>
      {rows}
    </section>
  );
}

function LedgerRow({
  icon,
  label,
  value,
  detail
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,0.85fr)_minmax(180px,0.55fr)] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-sm leading-5 text-fg-muted">{detail}</div>
      </div>
      <div className="truncate font-mono text-xl font-bold text-fg sm:text-right" title={value}>
        {value}
      </div>
    </div>
  );
}
