import { ImageResponse } from "next/og";

/**
 * Shared renderer for dynamic Open Graph / Twitter cards (next/og).
 * 1200×630, dark brand palette (hex literals are required here — ImageResponse
 * runs outside the Tailwind/CSS-variable layer and only supports inline styles).
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const BG = "#070a0e";
const BG_2 = "#0c1018";
const FG = "#f8fafc";
const MUTED = "#98a3b4";
const BRAND = "#8F6CF9";
const BRAND_MID = "#6EE7F9";
const ACCENT = "#52D4A6";
const BORDER = "#1c2330";

export function renderOgCard({
  eyebrow,
  title,
  subtitle,
  badge,
  tone = "brand",
  metrics = [],
  footerItems = ["Verifiable on-chain", "Non-custodial", "Chainlink VRF"]
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Optional pill in the top-right, e.g. a payout or odds highlight. */
  badge?: string;
  /** Controls the badge/metric accent without changing the whole card palette. */
  tone?: "brand" | "success" | "warning" | "muted";
  metrics?: Array<{ label: string; value: string }>;
  footerItems?: string[];
}) {
  const toneColor = getToneColor(tone);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: `linear-gradient(135deg, ${BG_2} 0%, ${BG} 60%)`,
        color: FG,
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
          background: `radial-gradient(circle, ${rgba(BRAND, 0.2)} 0%, ${rgba(
            BRAND_MID,
            0.09
          )} 42%, transparent 72%)`
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "absolute",
          right: "78px",
          top: "150px",
          width: "250px",
          height: "250px",
          opacity: 0.18,
          transform: "rotate(14deg)"
        }}
      >
        <BrandMark size={250} />
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
        {badge ? (
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
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1000px" }}>
        <div
          style={{
            display: "flex",
            fontSize: "22px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "4px",
            color: BRAND
          }}
        >
          {eyebrow}
        </div>
        <div style={{ display: "flex", fontSize: "78px", fontWeight: 800, lineHeight: 1.05 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: "32px", color: MUTED, lineHeight: 1.3 }}>
          {subtitle}
        </div>
        {metrics.length > 0 ? (
          <div style={{ display: "flex", gap: "14px", marginTop: "12px" }}>
            {metrics.slice(0, 3).map((metric) => (
              <div
                key={`${metric.label}:${metric.value}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                  minWidth: "158px",
                  border: `1px solid ${BORDER}`,
                  borderRadius: "18px",
                  background: rgba("#111827", 0.66),
                  padding: "14px 18px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "15px",
                    fontWeight: 800,
                    letterSpacing: "2.2px",
                    textTransform: "uppercase",
                    color: MUTED
                  }}
                >
                  {metric.label}
                </div>
                <div style={{ display: "flex", fontSize: "26px", fontWeight: 900, color: FG }}>
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
          gap: "16px",
          paddingTop: "28px",
          borderTop: `1px solid ${BORDER}`,
          fontSize: "24px",
          color: MUTED
        }}
      >
        <div
          style={{
            display: "flex",
            width: "10px",
            height: "10px",
            borderRadius: "9999px",
            background: BRAND_MID
          }}
        />
        {footerItems.map((item, index) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex", color: index > 0 ? BORDER : "transparent" }}>•</div>
            <div style={{ display: "flex" }}>{item}</div>
          </div>
        ))}
      </div>
    </div>,
    { ...OG_SIZE }
  );
}

function BrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <defs>
        <linearGradient id={`ag-og-brand-${size}`} x1="16" y1="12" x2="80" y2="84">
          <stop offset="0%" stopColor={BRAND} />
          <stop offset="52%" stopColor={BRAND_MID} />
          <stop offset="100%" stopColor={ACCENT} />
        </linearGradient>
        <linearGradient id={`ag-og-accent-${size}`} x1="28" y1="28" x2="68" y2="68">
          <stop offset="0%" stopColor={BRAND_MID} />
          <stop offset="100%" stopColor={ACCENT} />
        </linearGradient>
      </defs>
      <polygon
        points="48,14 77,31 77,65 48,82 19,65 19,31"
        fill={rgba(BRAND, 0.12)}
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
      <circle cx="40" cy="40" r="3.5" fill={FG} />
      <circle cx="56" cy="40" r="3.5" fill={FG} />
      <circle cx="48" cy="48" r="3.5" fill={FG} />
      <circle cx="40" cy="56" r="3.5" fill={FG} />
      <circle cx="56" cy="56" r="3.5" fill={FG} />
    </svg>
  );
}

function getToneColor(tone: "brand" | "success" | "warning" | "muted") {
  if (tone === "success") return ACCENT;
  if (tone === "warning") return "#F8C76B";
  if (tone === "muted") return MUTED;
  return BRAND;
}

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
