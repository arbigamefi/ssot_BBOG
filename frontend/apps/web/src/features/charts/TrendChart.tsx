"use client";

import * as React from "react";
import { cn } from "@ssot/ui";

/**
 * Shared trend chart — the hand-drawn SVG primitive behind the vault equity
 * curve and the casino volume trend. It renders only the *chart frame* (the
 * projected area + line, an optional secondary volume strip, Y-axis reference
 * lines, a hover crosshair + tooltip, and the date axis); callers own the
 * surrounding title, best-effort label, and any summary stats.
 *
 * Why a single shared SVG and not two bespoke ones / a chart library:
 *  - One projection means both charts read identically and cannot drift apart.
 *  - bigint math is projected to a fixed viewBox with no float accumulation, so
 *    integer token amounts stay exact.
 *  - Segments are deliberately LINEAR (no spline smoothing): every vertex is a
 *    real daily mark, and smoothing would invent intermediate values the index
 *    never recorded — inconsistent with this product's data-honesty stance.
 */

export interface TrendChartPoint {
  /** ISO date "YYYY-MM-DD"; used as the x-axis label and the React key. */
  date: string;
  /** Primary series value drawn as the area + line. May be negative when `signed`. */
  value: bigint;
  /** Optional secondary value drawn as a quiet bar strip beneath the line. */
  volume?: bigint;
}

export interface TrendChartTooltipRow {
  label: string;
  value: string;
  tone?: "win" | "loss";
}

export interface TrendChartProps {
  points: TrendChartPoint[];
  /** Accessible name for the SVG figure. */
  ariaLabel: string;
  /** Format a series value for Y-axis labels (and the default tooltip row). */
  formatValue: (value: bigint) => string;
  /** Format an ISO date for the x-axis ends and the tooltip heading. */
  formatDate: (date: string) => string;
  /**
   * When true the series can cross zero: a dashed zero waterline is drawn and
   * the curve is tinted by its final sign (green above water, red below). When
   * false (e.g. volume) the series is treated as non-negative, grounded at zero
   * and painted in the neutral brand tone.
   */
  signed?: boolean;
  /** Per-point tooltip rows. Defaults to a single row from `formatValue`. */
  tooltipRows?: (point: TrendChartPoint, index: number) => TrendChartTooltipRow[];
  /**
   * Optional "last value" callout pinned at the curve's right edge — for a
   * point-in-time reference on a *different* scale (e.g. share price) that must
   * not be plotted as a fake series. Hidden while the chart is hovered.
   */
  lastValueTag?: { label: string; value: string };
  className?: string;
}

/** UTC day/month label shared by every trend chart (e.g. "28 May"). */
export function formatDayLabel(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function TrendChart({
  points,
  ariaLabel,
  formatValue,
  formatDate,
  signed = false,
  tooltipRows,
  lastValueTag,
  className
}: TrendChartProps) {
  // Hooks must run unconditionally, before any early return.
  const gradId = React.useId();
  const [hover, setHover] = React.useState<number | null>(null);

  if (points.length === 0) return null;

  // Fixed viewBox in unitless SVG space; CSS controls the rendered size.
  const W = 600;
  const H = 160;
  const hasVolume = points.some((point) => point.volume != null);
  const VOL_H = hasVolume ? 28 : 0; // volume strip height inside the viewBox
  const PAD_TOP = 8;
  const bandH = H - VOL_H - PAD_TOP;

  const values = points.map((point) => point.value);
  let maxV = values.reduce((m, v) => (v > m ? v : m), 0n);
  let minV = values.reduce((m, v) => (v < m ? v : m), 0n);
  // Always include the zero baseline in the visible range.
  if (maxV < 0n) maxV = 0n;
  if (minV > 0n) minV = 0n;
  const span = maxV - minV === 0n ? 1n : maxV - minV;

  const peakValue = values.reduce((m, v) => (v > m ? v : m), values[0]!);
  const troughValue = values.reduce((m, v) => (v < m ? v : m), values[0]!);
  const finalValue = values[values.length - 1]!;
  const up = finalValue >= 0n;

  // Project a value to a y pixel inside the plot band (top = max). bigint math
  // is scaled by 1000 for sub-pixel precision without floats.
  const yOf = (value: bigint) =>
    PAD_TOP + Number(((maxV - value) * BigInt(Math.round(bandH * 1000))) / span) / 1000;
  const xOf = (index: number) => (points.length <= 1 ? W / 2 : (index / (points.length - 1)) * W);
  const baselineY = yOf(0n);
  // viewBox px → container percentage (preserveAspectRatio="none" stretches the
  // viewBox to fill, so a linear x/y maps to a flat percentage of the box).
  const xPct = (index: number) => (xOf(index) / W) * 100;
  const yPct = (value: bigint) => (yOf(value) / H) * 100;

  const linePoints = points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`);
  const areaPath = `M0,${baselineY.toFixed(1)} L${linePoints.join(" L")} L${W},${baselineY.toFixed(
    1
  )} Z`;
  const linePath = `M${linePoints.join(" L")}`;

  const maxVolume = hasVolume
    ? points.reduce((m, p) => ((p.volume ?? 0n) > m ? (p.volume ?? 0n) : m), 0n)
    : 0n;
  const volTop = H - VOL_H;

  // Inline hsl(var(--token)) is the established SVG color pattern in this app
  // (see ArbiGameFiBrand). Tailwind fill-*/stroke-* utilities are not wired for
  // these custom tokens, so SVG paint is driven directly.
  const stroke = signed ? (up ? "hsl(var(--success))" : "hsl(var(--danger))") : "hsl(var(--brand))";

  // Y-axis reference rows: peak / zero / trough, de-duplicated by value so a
  // flat (all-positive or all-negative) series does not print overlapping ticks.
  const axisRows = [
    { key: "peak", value: peakValue },
    { key: "zero", value: 0n },
    { key: "trough", value: troughValue }
  ].filter((row, i, rows) => rows.findIndex((r) => r.value === row.value) === i);

  const hovered = hover != null ? points[hover] : null;
  const hoverRows =
    hovered != null
      ? (tooltipRows?.(hovered, hover!) ?? [
          { label: ariaLabel, value: formatValue(hovered.value) }
        ])
      : [];

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative overflow-hidden rounded-md border border-border-soft bg-surface-0/70">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
          className="h-44 w-full"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Y-axis gridlines at peak / zero / trough for read-off reference. */}
          {axisRows.map((row) => (
            <line
              key={row.key}
              x1="0"
              y1={yOf(row.value).toFixed(1)}
              x2={W}
              y2={yOf(row.value).toFixed(1)}
              stroke={row.key === "zero" ? "hsl(var(--border))" : "hsl(var(--border-soft))"}
              strokeWidth="1"
              strokeDasharray={row.key === "zero" ? "4 4" : "2 4"}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Optional secondary volume strip along the bottom. */}
          {hasVolume ? (
            <>
              {points.map((p, i) => {
                const h =
                  maxVolume > 0n ? Number(((p.volume ?? 0n) * BigInt(VOL_H)) / maxVolume) : 0;
                const barW = (W / points.length) * 0.6;
                const cx = xOf(i);
                return (
                  <rect
                    key={p.date}
                    x={(cx - barW / 2).toFixed(1)}
                    y={(H - h).toFixed(1)}
                    width={barW.toFixed(1)}
                    height={h.toFixed(1)}
                    rx="1"
                    fill="hsl(var(--brand) / 0.22)"
                  />
                );
              })}
              <line
                x1="0"
                y1={volTop}
                x2={W}
                y2={volTop}
                stroke="hsl(var(--border-soft))"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}

          {/* Primary series — area + line. */}
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Hover crosshair — a vertical line stays true under non-uniform
              scaling, so it lives in SVG; the marker dot does not (it would
              shear into an ellipse) and is drawn as an HTML node below. */}
          {hovered ? (
            <line
              x1={xOf(hover!).toFixed(1)}
              y1="0"
              x2={xOf(hover!).toFixed(1)}
              y2={volTop}
              stroke={stroke}
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {/* HTML overlay — Y-axis labels, last-value tag, hover dot, tooltip.
            Positioned by percentage so nothing distorts under
            preserveAspectRatio="none". Scale labels sit on the LEFT axis; any
            last-value tag sits on the RIGHT (both standard for tearsheets). */}
        <div className="pointer-events-none absolute inset-0">
          {axisRows
            .filter((row) => row.key !== "zero")
            .map((row) => (
              <span
                key={row.key}
                className="absolute left-1.5 -translate-y-1/2 rounded bg-surface-1/80 px-1 font-mono text-[8px] font-semibold tabular-nums text-fg-subtle"
                style={{ top: `${yPct(row.value)}%` }}
              >
                {formatValue(row.value)}
              </span>
            ))}

          {!hovered && lastValueTag ? (
            <span
              className="absolute right-1.5 z-10 inline-flex -translate-y-1/2 items-center gap-1 rounded-full border border-dashed border-brand/50 bg-surface-1/95 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em]"
              style={{ top: `${yPct(finalValue)}%` }}
            >
              <span className="text-fg-subtle">{lastValueTag.label}</span>
              <span className="text-brand">{lastValueTag.value}</span>
            </span>
          ) : null}

          {hovered ? (
            <span
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-1"
              style={{
                left: `${xPct(hover!)}%`,
                top: `${yPct(hovered.value)}%`,
                background: stroke
              }}
            />
          ) : null}

          {hovered ? (
            <div
              className={cn(
                "absolute top-1.5 z-10 w-max max-w-[60%] rounded-md border border-border-soft bg-surface-1/95 px-2.5 py-2 shadow-e2",
                xPct(hover!) > 55 ? "-translate-x-full" : ""
              )}
              style={{
                left: `${xPct(hover!)}%`,
                marginLeft: xPct(hover!) > 55 ? -8 : 8
              }}
            >
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-fg-subtle">
                {formatDate(hovered.date)}
              </div>
              {hoverRows.map((row) => (
                <TrendTooltipRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  tone={row.tone}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Pointer capture sits on top so it receives events; the overlay above
            is pointer-events-none. Touch scrolling stays usable via touch-pan-y. */}
        <div
          className="absolute inset-0 touch-pan-y"
          data-testid="trend-chart-capture"
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
        <span>{formatDate(points[0]!.date)}</span>
        <span>{formatDate(points[points.length - 1]!.date)}</span>
      </div>
    </div>
  );
}

function TrendTooltipRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
}) {
  return (
    <div className="mt-1 flex items-center justify-between gap-4">
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[10px] font-bold tabular-nums",
          tone === "win" ? "text-success" : tone === "loss" ? "text-danger" : "text-fg"
        )}
      >
        {value}
      </span>
    </div>
  );
}
