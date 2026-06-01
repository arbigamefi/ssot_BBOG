"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { useCasinoStats, useCasinoTimeseries } from "../casino/useCasinoStats";
import { formatTokenAmount } from "../marketing/format";

type Translate = ReturnType<typeof useTranslations>;

const DEFAULT_WINDOW_DAYS = 30;

/** Time windows offered on the vault-performance view. `days` undefined = all-time. */
const WINDOW_OPTIONS: Array<{ days?: number; key: "all" | "d1" | "d7" | "d30" }> = [
  { days: 1, key: "d1" },
  { days: 7, key: "d7" },
  { days: 30, key: "d30" },
  { key: "all" }
];

/** Ratio of two bigint strings as a percentage string, e.g. "1.02%". */
function holdPercent(grossRevenue: bigint, turnover: bigint): string | null {
  if (turnover === 0n) return null;
  // basis points for 2-decimal precision; revenue can be negative when players win.
  const bps = Number((grossRevenue * 10000n) / turnover) / 100;
  return `${bps.toFixed(2)}%`;
}

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

function formatMultiple(numerator: bigint, denominator?: bigint): string | null {
  if (!denominator || denominator <= 0n) return null;
  const hundredths = Number((numerator * 100n) / denominator) / 100;
  return `${hundredths.toFixed(2)}x`;
}

function formatAnnualizedEstimate(
  houseRevenue: bigint,
  vaultAssets: bigint | undefined,
  windowDays: number | undefined
): string | null {
  if (!vaultAssets || vaultAssets <= 0n || !windowDays) return null;
  const sign = houseRevenue < 0n ? "−" : "";
  const absRevenue = houseRevenue < 0n ? -houseRevenue : houseRevenue;
  const bps = Number((absRevenue * 365n * 10_000n) / (vaultAssets * BigInt(windowDays))) / 100;
  return `${sign}${bps.toFixed(2)}%`;
}

/**
 * Vault performance — the provider-facing diligence view. Derives "is the house
 * bankroll making money?" from indexed bet activity, then combines it with the
 * chain-read vault balance when available to estimate turnover velocity. Every
 * indexed figure is labeled best-effort so it is never mistaken for on-chain truth.
 */
export function BankrollPerformancePanel({
  sharePrice,
  vaultAssets
}: {
  /** Latest chain-read assets redeemable per full LP share. Historical share-price points are not indexed yet. */
  sharePrice?: bigint;
  vaultAssets?: bigint;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [windowDays, setWindowDays] = React.useState<number | undefined>(DEFAULT_WINDOW_DAYS);

  const stats = useCasinoStats({ windowDays });
  // The chart wants daily granularity; cap to the largest supported window when
  // showing all-time (the timeseries service clamps to 90 days regardless).
  const timeseries = useCasinoTimeseries({ days: windowDays ?? 90 });

  const unavailable = stats.data?.source === "unavailable";
  const aggregate = stats.data?.stats;
  const decimals = stats.data?.asset.decimals ?? 6;
  const symbol = stats.data?.asset.symbol ?? "USDC";
  const points = timeseries.data?.source === "postgres" ? timeseries.data.points : [];

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

  if (unavailable || !aggregate) {
    return (
      <section className="rounded-md border border-border bg-surface-1 shadow-e2">
        <PerformanceHeader t={t} windowToggle={windowToggle} />
        <div className="border-t border-border-soft px-5 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg-subtle">
            {t("earn.performance.empty")}
          </p>
        </div>
      </section>
    );
  }

  const turnover = BigInt(aggregate.turnover || "0");
  const payout = BigInt(aggregate.payout || "0");
  // Gross gaming revenue = what players staked minus what the vault paid back.
  // Positive = the house (and therefore providers) is ahead.
  const houseRevenue = turnover - payout;
  const hold = holdPercent(houseRevenue, turnover);
  const velocity = formatMultiple(turnover, vaultAssets);
  const grossAnnualized = formatAnnualizedEstimate(houseRevenue, vaultAssets, windowDays);

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
      key: "grossAnnualized",
      label: t("earn.performance.grossAnnualized"),
      value: grossAnnualized ?? "—",
      tone: houseRevenue >= 0n ? "win" : "loss"
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
      value: aggregate.betCount.toLocaleString(locale)
    },
    {
      key: "players",
      label: t("earn.performance.players"),
      value: aggregate.uniquePlayers.toLocaleString(locale)
    }
  ];

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <PerformanceHeader t={t} windowToggle={windowToggle} />

      <div className="grid border-t border-border-soft lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
        {/* Headline — House P&L, the number a provider cares about most. It is
            handled as a report figure, not a promotional APY tile. */}
        <div className="border-b border-border-soft p-5 lg:border-b-0 lg:border-r">
          <div
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.18em]",
              houseRevenue >= 0n ? "text-success" : "text-danger"
            )}
          >
            {t("earn.performance.housePnl")}
          </div>
          <div
            className={cn(
              "mt-2 truncate font-mono text-4xl font-bold",
              houseRevenue >= 0n ? "text-success" : "text-danger"
            )}
            title={formatSignedToken(houseRevenue, decimals, symbol, locale)}
          >
            {formatSignedToken(houseRevenue, decimals, symbol, locale)}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            {t("earn.performance.bestEffort")}
          </div>
        </div>

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
      </div>

      <VaultActivityChart
        decimals={decimals}
        locale={locale}
        points={points}
        sharePrice={sharePrice}
        symbol={symbol}
        t={t}
      />

      {/* Honesty note — what this number is and is not. Keeps providers from
          mistaking gross gaming revenue for net yield. */}
      <p className="border-t border-border-soft px-5 py-4 text-[10px] leading-4 text-fg-subtle">
        {t("earn.performance.note")}
      </p>
    </section>
  );
}

function PerformanceHeader({ t, windowToggle }: { t: Translate; windowToggle: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-fg">
        {t("earn.performance.title")}
      </h2>
      {windowToggle}
    </div>
  );
}

/**
 * Daily vault activity — volume is the business engine, P&L is the variance,
 * and share price is the chain-read provider value reference. We only have the
 * latest share price today; historical share-price lines require Bank snapshot
 * indexing, so this chart deliberately renders a current reference line rather
 * than inventing a false history.
 */
function VaultActivityChart({
  points,
  decimals,
  locale,
  sharePrice,
  symbol,
  t
}: {
  points: Array<{ date: string; turnover: string; payout: string }>;
  decimals: number;
  locale: string;
  sharePrice?: bigint;
  symbol: string;
  t: Translate;
}) {
  if (points.length === 0) return null;

  const daily = points.map((point) => ({
    date: point.date,
    turnover: BigInt(point.turnover || "0"),
    pnl: BigInt(point.turnover || "0") - BigInt(point.payout || "0")
  }));
  const maxAbs = daily.reduce((max, day) => {
    const abs = day.pnl < 0n ? -day.pnl : day.pnl;
    return abs > max ? abs : max;
  }, 0n);
  const maxTurnover = daily.reduce((max, day) => (day.turnover > max ? day.turnover : max), 0n);
  const sharePriceLabel =
    sharePrice != null ? formatSharePrice(sharePrice, decimals, symbol, locale) : null;

  return (
    <div className="border-t border-border-soft px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
          {t("earn.performance.activityTrend")}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand/35" />
            {t("earn.performance.volumeTrend")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-success" />
            {t("earn.performance.pnlTrend")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-brand" />
            {t("earn.performance.sharePriceReference")}
          </span>
          <span className="rounded-full border border-border-soft bg-surface-0 px-3 py-1 font-mono">
            {t("earn.performance.bestEffort")}
          </span>
        </div>
      </div>
      <div className="relative mt-4 overflow-hidden rounded-md border border-border-soft bg-surface-0/70 px-3 py-4">
        {sharePriceLabel ? (
          <div className="pointer-events-none absolute inset-x-3 top-7 z-20">
            <div className="border-t border-dashed border-brand/80" />
            <div className="mt-1 inline-flex rounded-full border border-brand/35 bg-surface-1/95 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-brand">
              {t("earn.performance.currentSharePrice")}: {sharePriceLabel}
            </div>
          </div>
        ) : null}
        {/* Zero baseline in the middle; positive P&L grows up, negative P&L grows down.
            Daily volume is a muted background bar because it is scale-incompatible
            with P&L but still important for provider diligence. */}
        <div className="relative flex h-40 items-stretch gap-2 overflow-x-auto pb-1">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 border-t border-border" />
          {daily.map((day) => {
            const abs = day.pnl < 0n ? -day.pnl : day.pnl;
            const pnlPct = maxAbs > 0n ? Math.max(4, Number((abs * 4_500n) / maxAbs) / 100) : 4;
            const turnoverPct =
              maxTurnover > 0n
                ? Math.max(6, Number((day.turnover * 10_000n) / maxTurnover) / 100)
                : 6;
            const positive = day.pnl >= 0n;
            const date = new Date(`${day.date}T00:00:00.000Z`);
            const label = new Intl.DateTimeFormat(locale, {
              day: "2-digit",
              month: "short",
              timeZone: "UTC"
            }).format(date);
            const valueLabel = formatSignedToken(day.pnl, decimals, symbol, locale);
            const turnoverLabel = formatTokenAmount(day.turnover, decimals, symbol, locale);
            return (
              <div
                key={day.date}
                className="relative flex min-w-8 flex-1 flex-col items-center sm:min-w-10"
              >
                <div
                  className="absolute bottom-5 z-0 w-full rounded-t-sm bg-brand/25"
                  style={{ height: `${turnoverPct}%` }}
                  title={`${label} ${t("earn.performance.volumeTrend")}: ${turnoverLabel}`}
                />
                <div className="relative z-10 flex h-full w-full flex-col justify-center px-1">
                  <div className="flex h-1/2 items-end justify-center">
                    <div
                      className={cn("w-3 rounded-t-sm", positive ? "bg-success" : "bg-transparent")}
                      style={{ height: positive ? `${pnlPct}%` : 0 }}
                      title={`${label} ${t("earn.performance.pnlTrend")}: ${valueLabel}`}
                    />
                  </div>
                  <div className="flex h-1/2 items-start justify-center">
                    <div
                      className={cn("w-3 rounded-b-sm", positive ? "bg-transparent" : "bg-danger")}
                      style={{ height: positive ? 0 : `${pnlPct}%` }}
                      title={`${label} ${t("earn.performance.pnlTrend")}: ${valueLabel}`}
                    />
                  </div>
                </div>
                <span className="mt-1 w-full truncate text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
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
