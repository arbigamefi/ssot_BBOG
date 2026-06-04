import { ImageResponse } from "next/og";
import type * as React from "react";

import { OG_COLORS, OgGlyph, type OgGlyphKind, type OgTone, getOgToneColor } from "./glyphs";

/**
 * Shared renderer for dynamic Open Graph / Twitter cards (next/og).
 * 1200×630, dark brand palette (hex literals are required here — ImageResponse
 * runs outside the Tailwind/CSS-variable layer and only supports inline styles).
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export function renderOgCard({
  eyebrow,
  title,
  subtitle,
  badge,
  tone = "brand",
  visual,
  visualKind,
  visualSize = 330,
  stat,
  variant = "campaign",
  metrics = [],
  footerItems = ["Provably fair", "Non-custodial", "Chainlink VRF"],
  headers
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Optional pill in the top-right, e.g. a payout or odds highlight. */
  badge?: string;
  /** Controls the badge/metric accent without changing the whole card palette. */
  tone?: "brand" | "success" | "warning" | "muted" | OgTone;
  /** Right-side visual. Use this for custom Satori-compatible SVG/JSX. */
  visual?: React.ReactNode;
  /** Convenience key for the built-in OG glyph set. */
  visualKind?: OgGlyphKind;
  visualSize?: number;
  /** Large right-side hook, usually a multiplier, role, or status. */
  stat?: string;
  /** Campaign cards are ad-like; utility cards are calmer; receipt cards favor result proof. */
  variant?: "campaign" | "utility" | "receipt";
  metrics?: Array<{ label: string; value: string }>;
  footerItems?: string[];
  /** Optional response headers for dynamic OG routes that must not inherit static image caching. */
  headers?: HeadersInit;
}) {
  const toneColor = getToneColor(tone);
  const titleSize = getTitleSize(title);
  const subtitleSize = getSubtitleSize(subtitle);
  const rightVisual = visual ?? (
    <OgGlyph kind={visualKind ?? "casino"} size={visualSize} tone={toGlyphTone(tone)} />
  );
  const rightStat = stat ?? badge ?? metrics[0]?.value;
  const utility = variant === "utility";
  const receipt = variant === "receipt";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: `linear-gradient(135deg, ${OG_COLORS.surface} 0%, ${OG_COLORS.bg} 60%)`,
        color: OG_COLORS.fg,
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "absolute",
          right: "-110px",
          top: "92px",
          width: "460px",
          height: "460px",
          borderRadius: "9999px",
          background: `radial-gradient(circle, ${rgba(toneColor, utility ? 0.15 : 0.26)} 0%, ${rgba(
            OG_COLORS.cyan,
            utility ? 0.05 : 0.1
          )} 42%, transparent 72%)`
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "78px",
          top: "128px",
          width: "384px",
          height: "354px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "56px",
            background: `radial-gradient(circle at 50% 45%, ${rgba(toneColor, utility ? 0.08 : 0.16)}, transparent 66%)`,
            border: `1px solid ${rgba(OG_COLORS.border, 0.5)}`
          }}
        />
        <div
          style={{
            display: "flex",
            position: "relative",
            transform: utility ? "scale(0.9)" : "scale(1)"
          }}
        >
          {rightVisual}
        </div>
        {rightStat ? (
          <div
            style={{
              position: "absolute",
              right: receipt ? "18px" : "8px",
              bottom: receipt ? "28px" : "10px",
              display: "flex",
              padding: receipt ? "8px 18px" : "10px 20px",
              borderRadius: "22px",
              background: rgba(OG_COLORS.bg, 0.82),
              border: `2px solid ${rgba(toneColor, 0.6)}`,
              color: toneColor,
              fontSize: receipt ? "31px" : getStatSize(rightStat),
              fontWeight: 900,
              letterSpacing: "-1px"
            }}
          >
            {rightStat}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "absolute",
          right: "92px",
          top: "165px",
          width: "220px",
          height: "220px",
          opacity: utility ? 0.06 : 0.035,
          transform: "rotate(14deg)",
          pointerEvents: "none"
        }}
      >
        <BrandMark size={220} />
      </div>

      {/* top row: wordmark + optional badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <BrandMark size={42} />
          <div style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.5px" }}>
            ArbiGameFi
          </div>
        </div>
        {badge && !rightStat ? (
          <div
            style={{
              display: "flex",
              fontSize: "26px",
              fontWeight: 800,
              color: toneColor,
              border: `2px solid ${rgba(toneColor, 0.65)}`,
              background: rgba(toneColor, 0.08),
              borderRadius: "9999px",
              padding: "8px 22px"
            }}
          >
            {badge}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>

      {/* center block */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: utility ? "18px" : "20px",
          maxWidth: utility ? "760px" : "650px"
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "22px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "4px",
            color: toneColor
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: utility ? Math.min(titleSize, 74) : titleSize,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: title.length > 34 ? "-1.5px" : "-0.8px"
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            maxWidth: utility ? "660px" : "620px",
            fontSize: subtitleSize,
            color: OG_COLORS.muted,
            lineHeight: 1.28
          }}
        >
          {subtitle}
        </div>
        {metrics.length > 0 && utility ? (
          <div style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
            {metrics.slice(0, 3).map((metric) => (
              <div
                key={`${metric.label}:${metric.value}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                  minWidth: "154px",
                  border: `1px solid ${OG_COLORS.border}`,
                  borderRadius: "18px",
                  background: rgba("#111827", 0.66),
                  padding: "13px 17px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "14px",
                    fontWeight: 800,
                    letterSpacing: "2.2px",
                    textTransform: "uppercase",
                    color: OG_COLORS.muted
                  }}
                >
                  {metric.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "25px",
                    fontWeight: 900,
                    color: OG_COLORS.fg
                  }}
                >
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* bottom trust strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          paddingTop: "28px",
          borderTop: `1px solid ${OG_COLORS.border}`,
          fontSize: "23px",
          color: OG_COLORS.muted
        }}
      >
        <div
          style={{
            display: "flex",
            width: "10px",
            height: "10px",
            borderRadius: "9999px",
            background: toneColor
          }}
        />
        {footerItems.map((item, index) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", color: index > 0 ? OG_COLORS.border : "transparent" }}>
              •
            </div>
            <div style={{ display: "flex" }}>{item}</div>
          </div>
        ))}
      </div>
    </div>,
    { ...OG_SIZE, headers }
  );
}

function BrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <defs>
        <linearGradient id={`ag-og-brand-${size}`} x1="16" y1="12" x2="80" y2="84">
          <stop offset="0%" stopColor={OG_COLORS.brand} />
          <stop offset="52%" stopColor={OG_COLORS.cyan} />
          <stop offset="100%" stopColor={OG_COLORS.green} />
        </linearGradient>
        <linearGradient id={`ag-og-accent-${size}`} x1="28" y1="28" x2="68" y2="68">
          <stop offset="0%" stopColor={OG_COLORS.cyan} />
          <stop offset="100%" stopColor={OG_COLORS.green} />
        </linearGradient>
      </defs>
      <polygon
        points="48,14 77,31 77,65 48,82 19,65 19,31"
        fill={rgba(OG_COLORS.brand, 0.12)}
        stroke={`url(#ag-og-brand-${size})`}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <rect
        x="32"
        y="32"
        width="32"
        height="32"
        rx="7"
        stroke={`url(#ag-og-accent-${size})`}
        strokeWidth="5"
      />
      <circle cx="40" cy="40" r="3.5" fill={OG_COLORS.fg} />
      <circle cx="56" cy="40" r="3.5" fill={OG_COLORS.fg} />
      <circle cx="48" cy="48" r="3.5" fill={OG_COLORS.fg} />
      <circle cx="40" cy="56" r="3.5" fill={OG_COLORS.fg} />
      <circle cx="56" cy="56" r="3.5" fill={OG_COLORS.fg} />
    </svg>
  );
}

function getToneColor(tone: "brand" | "success" | "warning" | "muted" | OgTone) {
  if (tone === "success") return OG_COLORS.green;
  if (tone === "warning") return "#F8C76B";
  if (tone === "muted") return OG_COLORS.muted;
  return getOgToneColor(toGlyphTone(tone));
}

function toGlyphTone(tone: "brand" | "success" | "warning" | "muted" | OgTone): OgTone {
  if (tone === "success") return "green";
  if (tone === "warning") return "amber";
  if (tone === "muted") return "muted";
  return tone;
}

function getTitleSize(title: string) {
  if (title.length > 58) return 56;
  if (title.length > 42) return 62;
  if (title.length > 30) return 74;
  return 84;
}

function getSubtitleSize(subtitle: string) {
  if (subtitle.length > 98) return 27;
  if (subtitle.length > 74) return 29;
  return 32;
}

function getStatSize(stat: string) {
  if (stat.length > 14) return "34px";
  if (stat.length > 9) return "42px";
  return "54px";
}

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
