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
  error
}: {
  data?: EarnBankData;
  decimals: number;
  symbol: string;
  loading: boolean;
  error?: string;
}) {
  const t = useTranslations();
  const snapshot = data?.snapshot;
  const position = data?.position;
  const minLiquidity =
    snapshot?.minLiquidityBps != null
      ? (snapshot.totalAssets * BigInt(snapshot.minLiquidityBps)) / 10_000n
      : undefined;
  const freeReserve = snapshot
    ? snapshot.totalAssets > snapshot.totalReserved
      ? snapshot.totalAssets - snapshot.totalReserved
      : 0n
    : undefined;

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

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
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
        <SummaryCard
          label={t("earn.summary.freeReserve.label")}
          value={formatTokenAmount(freeReserve, decimals, symbol, 2)}
          detail={t("earn.summary.freeReserve.detail")}
        />
        <SummaryCard
          label={t("earn.summary.reserved.label")}
          value={formatTokenAmount(snapshot?.totalReserved, decimals, symbol, 2)}
          detail={t("earn.summary.reserved.detail", {
            freeReserve: formatTokenAmount(freeReserve, decimals, symbol, 2),
            minLiquidity: formatTokenAmount(minLiquidity, decimals, symbol, 2)
          })}
        />
        <SummaryCard
          icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
          label={t("earn.summary.position.label")}
          value={formatTokenAmount(position?.assetsEquivalent, decimals, symbol, 4)}
          detail={t("earn.summary.position.detail")}
        />
        <SummaryCard
          icon={<InformationCircleIcon className="h-5 w-5" />}
          label={t("earn.summary.liquidity.label")}
          value={formatPctFromBps(snapshot?.minLiquidityBps)}
          detail={t("earn.summary.liquidity.detail", {
            floor: formatBps(snapshot?.minLiquidityBps),
            bank: shortHex(snapshot?.bank)
          })}
        />
      </div>
    </section>
  );
}

function SummaryCard({
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
    <div className="rounded-md border border-border bg-surface-1 p-5 shadow-e1">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-3 truncate font-mono text-2xl font-bold text-fg" title={value}>
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-fg-muted">{detail}</div>
    </div>
  );
}
