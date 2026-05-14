import * as React from "react";
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";

import { formatBps, formatPctFromBps, formatTokenAmount, shortHex } from "./format";
import type { EarnBankData } from "./types";

const CAPITAL_POSTURE_SERIES = [
  24, 26, 28, 30, 31, 34, 36, 38, 40, 42, 45, 48, 50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74, 78
];

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
  const snapshot = data?.snapshot;
  const position = data?.position;
  const minLiquidity =
    snapshot?.minLiquidityBps != null
      ? (snapshot.totalAssets * BigInt(snapshot.minLiquidityBps)) / 10_000n
      : undefined;

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-md border border-border bg-surface-1 shadow-e2">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-black text-fg">
            <ChartBarIcon className="h-5 w-5 text-brand" />
            Capital posture
          </div>
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
            read model
          </span>
        </div>

        <div className="relative min-h-72 overflow-hidden p-5">
          <svg
            className="absolute inset-x-5 bottom-5 h-48 text-accent"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <linearGradient id="earnCapitalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <path
              d="M0,100 L0,70 Q10,60 20,65 T40,40 T60,45 T80,10 T100,5 L100,100 Z"
              fill="url(#earnCapitalGradient)"
            />
            <path
              d="M0,70 Q10,60 20,65 T40,40 T60,45 T80,10 T100,5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <div className="absolute inset-x-5 bottom-5 flex h-48 items-end justify-between">
            {CAPITAL_POSTURE_SERIES.map((height, index) => (
              <div
                key={index}
                className="w-[3%] rounded-sm border-t border-accent/40 bg-accent/10"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="relative z-10 max-w-md">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
              Total assets
            </div>
            <div className="mt-2 font-mono text-4xl font-black text-fg">
              {formatTokenAmount(snapshot?.totalAssets, decimals, symbol, 2)}
            </div>
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              {loading
                ? "Synchronizing bank snapshot from the selected release."
                : error
                  ? error
                  : "Chart is a posture visual. Numeric truth comes from the bank snapshot below."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <SummaryCard
          icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
          label="Your position"
          value={formatTokenAmount(position?.assetsEquivalent, decimals, symbol, 4)}
          detail="Assets equivalent for the connected wallet."
        />
        <SummaryCard
          icon={<InformationCircleIcon className="h-5 w-5" />}
          label="Liquidity policy"
          value={formatPctFromBps(snapshot?.minLiquidityBps)}
          detail={`Floor ${formatBps(snapshot?.minLiquidityBps)} · Bank ${shortHex(snapshot?.bank)}`}
        />
        <SummaryCard
          label="Reserved liabilities"
          value={formatTokenAmount(snapshot?.totalReserved, decimals, symbol, 2)}
          detail={`Free reserve ${formatTokenAmount(
            snapshot && snapshot.totalAssets > snapshot.totalReserved
              ? snapshot.totalAssets - snapshot.totalReserved
              : undefined,
            decimals,
            symbol,
            2
          )} · Min liquidity ${formatTokenAmount(minLiquidity, decimals, symbol, 2)}`}
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
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-3 font-mono text-2xl font-black text-fg">{value}</div>
      <div className="mt-2 text-sm leading-6 text-fg-muted">{detail}</div>
    </div>
  );
}
