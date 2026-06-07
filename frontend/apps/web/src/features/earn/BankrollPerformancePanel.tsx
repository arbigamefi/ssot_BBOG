"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@ssot/ui";
import type { DomainBankSnapshot } from "@ssot/ssot";

import { useCasinoTimeseries } from "../casino/useCasinoStats";
import { formatTokenAmount } from "../marketing/format";
import { TrendChart, formatDayLabel, type TrendChartPoint } from "../charts/TrendChart";
import { formatHoldPercent, formatMultiple } from "./format";

type Translate = ReturnType<typeof useTranslations>;

const DEFAULT_WINDOW_DAYS = 30;

/** Time windows offered on the vault-performance view. `days` undefined = all-time. */
const WINDOW_OPTIONS: Array<{ days?: number; key: "all" | "d1" | "d7" | "d30" }> = [
  { days: 1, key: "d1" },
  { days: 7, key: "d7" },
  { days: 30, key: "d30" },
  { key: "all" }
];

/** Format a signed token amount, prefixing a minus glyph for negatives. */
function formatSignedToken(
  value: bigint,
  decimals: number,
  symbol: string,
  locale: string
): string {
  if (value < 0n) {
    return `−${formatTokenAmount(-value, decimals, symbol, locale)}`;
  }
  return formatTokenAmount(value, decimals, symbol, locale);
}

/**
 * Vault performance — the provider-facing diligence view. The headline figures
 * (House P&L, hold, velocity, turnover, payout, bets) are lifetime totals read
 * directly from Bank.getSnapshot() on-chain. The daily chart below it is an
 * indexed trend — the chain does not store historical daily buckets — and the
 * time-window toggle scopes only that chart, never the lifetime headline.
 */
export function BankrollPerformancePanel({
  assetAddress,
  assetDecimals = 6,
  assetSymbol = "UNIT",
  chainPerformance,
  sharePrice,
  vaultAssets
}: {
  assetAddress?: string;
  assetDecimals?: number;
  assetSymbol?: string;
  chainPerformance?: DomainBankSnapshot;
  /** Latest chain-read assets redeemable per full LP share. Historical share-price points are not indexed yet. */
  sharePrice?: bigint;
  vaultAssets?: bigint;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [windowDays, setWindowDays] = React.useState<number | undefined>(DEFAULT_WINDOW_DAYS);

  // The chart wants daily granularity; cap to the largest supported window when
  // showing all-time (the timeseries service clamps to 90 days regardless).
  const timeseries = useCasinoTimeseries({ asset: assetAddress, days: windowDays ?? 90 });

  const decimals = assetDecimals;
  const symbol = assetSymbol;
  const points = timeseries.data?.source === "postgres" ? timeseries.data.points : [];
  const hasChainPerformance = Boolean(chainPerformance);

  // The window toggle governs the daily indexed chart only — so it lives in the
  // chart header, not the panel header, and disappears when there is no chart.
  const windowToggle = (
    <div
      role="tablist"
      aria-label={t("earn.performance.windowLabel")}
      className="flex flex-wrap gap-1.5"
    >
      {WINDOW_OPTIONS.map((option) => {
        const active = option.days === windowDays;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setWindowDays(option.days)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
              active
                ? "border-brand bg-brand-soft text-brand"
                : "border-border-soft bg-surface-0 text-fg-muted hover:border-brand/40 hover:text-fg"
            )}
          >
            {t(`earn.performance.windows.${option.key}`)}
          </button>
        );
      })}
    </div>
  );

  const turnover = chainPerformance?.totalTurnover ?? 0n;
  const payout = chainPerformance?.totalPayoutGross ?? 0n;
  // Gross gaming revenue = what players staked minus what the vault paid back.
  // Positive = the house (and therefore providers) is ahead.
  const houseRevenue = turnover - payout;
  const hold = formatHoldPercent(houseRevenue, turnover);
  const velocity = formatMultiple(turnover, vaultAssets);
  const betCount = chainPerformance?.totalBetsHeld ?? 0n;
  // No lifetime data to report until there is real turnover. Render a deliberate
  // empty state instead of a column of "—" that reads as broken.
  const hasLifetimeActivity = hasChainPerformance && turnover > 0n;

  const statRows: Array<{ key: string; label: string; value: string; tone?: "win" | "loss" }> = [
    {
      key: "hold",
      label: t("earn.performance.hold"),
      value: hold ?? "—",
      tone: houseRevenue >= 0n ? "win" : "loss"
    },
    {
      key: "velocity",
      label: t("earn.performance.velocity"),
      value: velocity ?? "—"
    },
    {
      key: "wagered",
      label: t("earn.performance.wagered"),
      value: formatTokenAmount(turnover, decimals, symbol, locale)
    },
    {
      key: "payout",
      label: t("earn.performance.payout"),
      value: formatTokenAmount(payout, decimals, symbol, locale)
    },
    {
      key: "bets",
      label: t("earn.performance.bets"),
      value: betCount.toLocaleString(locale)
    }
  ];

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <PerformanceHeader t={t} />

      <div className="grid border-t border-border-soft lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
        {/* Headline — lifetime House P&L, the number a provider cares about
            most. Handled as a report figure, not a promotional APY tile. */}
        <div className="border-b border-border-soft p-5 lg:border-b-0 lg:border-r">
          <div
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.18em]",
              !hasLifetimeActivity
                ? "text-fg-subtle"
                : houseRevenue >= 0n
                  ? "text-success"
                  : "text-danger"
            )}
          >
            {t("earn.performance.housePnl")}
          </div>
          <div
            className={cn(
              "mt-2 truncate font-mono text-4xl font-bold",
              !hasLifetimeActivity
                ? "text-fg-muted"
                : houseRevenue >= 0n
                  ? "text-success"
                  : "text-danger"
            )}
            title={formatSignedToken(houseRevenue, decimals, symbol, locale)}
          >
            {hasLifetimeActivity ? formatSignedToken(houseRevenue, decimals, symbol, locale) : "—"}
          </div>
        </div>

        {hasLifetimeActivity ? (
          <div className="divide-y divide-border-soft">
            {statRows.map((row) => (
              <div
                key={row.key}
                className="grid gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(120px,auto)] sm:items-center"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                  {row.label}
                </div>
                <div
                  className={cn(
                    "truncate font-mono text-base font-bold sm:text-right",
                    row.tone === "win"
                      ? "text-success"
                      : row.tone === "loss"
                        ? "text-danger"
                        : "text-fg"
                  )}
                  title={row.value}
                >
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center p-6 text-center">
            <p className="max-w-xs text-xs leading-5 text-fg-subtle">
              {t("earn.performance.empty")}
            </p>
          </div>
        )}
      </div>

      <VaultEquityChart
        decimals={decimals}
        locale={locale}
        points={points}
        sharePrice={sharePrice}
        symbol={symbol}
        t={t}
        windowToggle={windowToggle}
      />

      {/* Honesty note — what this number is and is not. Keeps providers from
          mistaking gross gaming revenue for net yield. */}
      <p className="border-t border-border-soft px-5 py-4 text-[10px] leading-4 text-fg-subtle">
        {t("earn.performance.note")}
      </p>
    </section>
  );
}

function PerformanceHeader({ t }: { t: Translate }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-fg">
        {t("earn.performance.title")}
      </h2>
      {/* One provenance tag scoping the whole lifetime headline block. The daily
          chart below carries its own "indexed" tag — the two are never mixed. */}
      <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-success">
        {t("earn.performance.lifetimeOnChain")}
      </span>
    </div>
  );
}

/**
 * Vault equity chart — the figure a fund tearsheet leads with: the *cumulative*
 * house P&L trajectory over a dashed zero waterline, so a provider reads "is the
 * bankroll trending up, and how deep did it dip?" at a glance. Peak, trough, and
 * max drawdown sit underneath as honest indexed stats. The shared <TrendChart>
 * owns the SVG; this wrapper derives the cumulative series and surrounding stats.
 */
function VaultEquityChart({
  points,
  decimals,
  locale,
  sharePrice,
  symbol,
  t,
  windowToggle
}: {
  points: Array<{ date: string; turnover: string; payout: string }>;
  decimals: number;
  locale: string;
  sharePrice?: bigint;
  symbol: string;
  t: Translate;
  windowToggle: React.ReactNode;
}) {
  if (points.length === 0) return null;

  // Build the cumulative equity series in integer units (no float drift). Each
  // day's P&L is stake minus payout; the running sum is the equity curve.
  let cumulative = 0n;
  const series = points.map((point) => {
    const turnover = BigInt(point.turnover || "0");
    const pnl = turnover - BigInt(point.payout || "0");
    cumulative += pnl;
    return { date: point.date, turnover, pnl, cumulative };
  });

  const chartPoints: TrendChartPoint[] = series.map((s) => ({
    date: s.date,
    value: s.cumulative,
    volume: s.turnover
  }));

  const cumulativeValues = series.map((s) => s.cumulative);
  const peakValue = cumulativeValues.reduce((m, v) => (v > m ? v : m), cumulativeValues[0]!);
  const troughValue = cumulativeValues.reduce((m, v) => (v < m ? v : m), cumulativeValues[0]!);

  // Max drawdown — the deepest peak-to-valley decline of the equity curve, the
  // single risk number a provider underwrites against. Derived from the indexed
  // series, so it is labelled best-effort alongside the chart.
  let runningPeak = cumulativeValues[0]!;
  let maxDrawdown = 0n;
  for (const value of cumulativeValues) {
    if (value > runningPeak) runningPeak = value;
    const decline = runningPeak - value;
    if (decline > maxDrawdown) maxDrawdown = decline;
  }

  const sharePriceLabel =
    sharePrice != null ? formatSharePrice(sharePrice, decimals, symbol, locale) : null;

  return (
    <div className="border-t border-border-soft px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
          {t("earn.performance.equityTitle")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {windowToggle}
          <span className="rounded-full border border-border-soft bg-surface-0 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            {t("earn.performance.bestEffort")}
          </span>
        </div>
      </div>

      <TrendChart
        className="mt-3"
        points={chartPoints}
        signed
        ariaLabel={t("earn.performance.equityTitle")}
        formatValue={(value) => formatSignedToken(value, decimals, symbol, locale)}
        formatDate={(date) => formatDayLabel(date, locale)}
        lastValueTag={
          sharePriceLabel
            ? { label: t("earn.performance.sharePriceReference"), value: sharePriceLabel }
            : undefined
        }
        tooltipRows={(_, index) => {
          const s = series[index]!;
          return [
            {
              label: t("earn.performance.equityTitle"),
              value: formatSignedToken(s.cumulative, decimals, symbol, locale),
              tone: s.cumulative >= 0n ? "win" : "loss"
            },
            {
              label: t("earn.performance.pnlTrend"),
              value: formatSignedToken(s.pnl, decimals, symbol, locale),
              tone: s.pnl >= 0n ? "win" : "loss"
            },
            {
              label: t("earn.performance.volumeTrend"),
              value: formatTokenAmount(s.turnover, decimals, symbol, locale)
            }
          ];
        }}
      />

      {/* Peak / trough / max drawdown — share price now lives on the chart as a
          last-value tag, so it is not duplicated here. */}
      <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2">
        <EquityStat
          label={t("earn.performance.peak")}
          value={formatSignedToken(peakValue, decimals, symbol, locale)}
          tone="win"
        />
        <EquityStat
          label={t("earn.performance.trough")}
          value={formatSignedToken(troughValue, decimals, symbol, locale)}
          tone={troughValue < 0n ? "loss" : "win"}
        />
        <EquityStat
          label={t("earn.performance.maxDrawdown")}
          value={formatSignedToken(-maxDrawdown, decimals, symbol, locale)}
          tone={maxDrawdown > 0n ? "loss" : "win"}
        />
      </div>
    </div>
  );
}

function EquityStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
}) {
  return (
    <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start">
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </span>
      <span
        className={cn(
          "truncate font-mono text-xs font-bold",
          tone === "win" ? "text-success" : tone === "loss" ? "text-danger" : "text-fg"
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function formatSharePrice(value: bigint, decimals: number, symbol: string, locale: string) {
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = value % scale;
  const precision = 4;
  const divisor = 10n ** BigInt(Math.max(decimals - precision, 0));
  const roundedFraction = decimals > precision ? fraction / divisor : fraction;
  const fractionText = roundedFraction.toString().padStart(Math.min(decimals, precision), "0");
  const trimmed = fractionText.replace(/0+$/, "");
  return `${whole.toLocaleString(locale)}${trimmed ? `.${trimmed}` : ""} ${symbol}`;
}
