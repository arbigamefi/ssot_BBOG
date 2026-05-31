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
      <section className="flex flex-col gap-4">
        <PerformanceHeader t={t} windowToggle={windowToggle} />
        <div className="rounded-xl border-2 border-dashed border-border-soft py-16 text-center">
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

  const cards: Array<{ key: string; label: string; value: string; tone?: "win" | "loss" }> = [
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
    <section className="flex flex-col gap-4">
      <PerformanceHeader t={t} windowToggle={windowToggle} />

      {/* Headline — House P&L, the number a provider cares about most. Framed in
          success/danger tone so "the vault is up/down" reads at a glance. */}
      <div
        className={cn(
          "rounded-xl border p-5 shadow-e1",
          houseRevenue >= 0n
            ? "border-success/30 bg-success-soft"
            : "border-danger/30 bg-danger-soft"
        )}
      >
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
            "mt-1 font-mono text-4xl font-bold",
            houseRevenue >= 0n ? "text-success" : "text-danger"
          )}
        >
          {formatSignedToken(houseRevenue, decimals, symbol, locale)}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
          {t("earn.performance.bestEffort")}
        </div>
      </div>

      <DailyPnlChart points={points} decimals={decimals} locale={locale} symbol={symbol} t={t} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-xl border border-border-soft bg-surface-0 p-4 shadow-e1"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {card.label}
            </div>
            <div
              className={cn(
                "mt-2 truncate font-mono text-xl font-bold",
                card.tone === "win"
                  ? "text-success"
                  : card.tone === "loss"
                    ? "text-danger"
                    : "text-fg"
              )}
              title={card.value}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Honesty note — what this number is and is not. Keeps providers from
          mistaking gross gaming revenue for net yield. */}
      <p className="text-[10px] leading-4 text-fg-subtle">{t("earn.performance.note")}</p>
    </section>
  );
}

function PerformanceHeader({ t, windowToggle }: { t: Translate; windowToggle: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
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
    <div className="rounded-xl border border-border-soft bg-surface-0 p-4 shadow-e1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
          {t("earn.performance.pnlTrend")}
        </div>
        <span className="rounded-full border border-border-soft bg-surface-1 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
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
