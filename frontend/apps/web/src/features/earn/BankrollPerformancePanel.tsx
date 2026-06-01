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
export function BankrollPerformancePanel({ vaultAssets }: { vaultAssets?: bigint }) {
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

      <DailyPnlChart points={points} decimals={decimals} locale={locale} symbol={symbol} t={t} />

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
 * Daily house P&L bars — the variance visualization. Green days the vault won,
 * red days players won. Tells the provider story directly: mostly green, the
 * occasional red, net positive over time (law of large numbers).
 */
function DailyPnlChart({
  points,
  decimals,
  locale,
  symbol,
  t
}: {
  points: Array<{ date: string; turnover: string; payout: string }>;
  decimals: number;
  locale: string;
  symbol: string;
  t: Translate;
}) {
  if (points.length === 0) return null;

  const daily = points.map((point) => ({
    date: point.date,
    pnl: BigInt(point.turnover || "0") - BigInt(point.payout || "0")
  }));
  const maxAbs = daily.reduce((max, day) => {
    const abs = day.pnl < 0n ? -day.pnl : day.pnl;
    return abs > max ? abs : max;
  }, 0n);

  return (
    <div className="border-t border-border-soft px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
          {t("earn.performance.pnlTrend")}
        </div>
        <span className="rounded-full border border-border-soft bg-surface-0 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
          {t("earn.performance.bestEffort")}
        </span>
      </div>
      {/* Zero baseline in the middle; positive bars grow up (success), negative
          grow down (danger). */}
      <div className="mt-4 flex h-28 items-stretch gap-2">
        {daily.map((day) => {
          const abs = day.pnl < 0n ? -day.pnl : day.pnl;
          const pct = maxAbs > 0n ? Math.max(4, Number((abs * 10_000n) / maxAbs) / 100) : 4;
          const positive = day.pnl >= 0n;
          const date = new Date(`${day.date}T00:00:00.000Z`);
          const label = new Intl.DateTimeFormat(locale, {
            day: "2-digit",
            month: "short",
            timeZone: "UTC"
          }).format(date);
          const valueLabel = formatSignedToken(day.pnl, decimals, symbol, locale);
          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex h-full w-full flex-col justify-center">
                {/* top half (positive) */}
                <div className="flex h-1/2 items-end">
                  {positive && (
                    <div
                      className="w-full rounded-t-sm bg-success"
                      style={{ height: `${pct}%` }}
                      title={`${label}: ${valueLabel}`}
                    />
                  )}
                </div>
                {/* bottom half (negative) */}
                <div className="flex h-1/2 items-start">
                  {!positive && (
                    <div
                      className="w-full rounded-b-sm bg-danger"
                      style={{ height: `${pct}%` }}
                      title={`${label}: ${valueLabel}`}
                    />
                  )}
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
  );
}
