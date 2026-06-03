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
  badge
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Optional pill in the top-right, e.g. a payout or odds highlight. */
  badge?: string;
}) {
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
        fontFamily: "sans-serif"
      }}
    >
      {/* top row: wordmark + optional badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <svg width="42" height="42" viewBox="0 0 96 96" fill="none">
            <defs>
              <linearGradient id="ag-og-brand" x1="16" y1="12" x2="80" y2="84">
                <stop offset="0%" stopColor={BRAND} />
                <stop offset="52%" stopColor={BRAND_MID} />
                <stop offset="100%" stopColor={ACCENT} />
              </linearGradient>
              <linearGradient id="ag-og-accent" x1="28" y1="28" x2="68" y2="68">
                <stop offset="0%" stopColor={BRAND_MID} />
                <stop offset="100%" stopColor={ACCENT} />
              </linearGradient>
            </defs>
            <polygon
              points="48,14 77,31 77,65 48,82 19,65 19,31"
              fill="rgba(99, 102, 241, 0.12)"
              stroke="url(#ag-og-brand)"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <rect
              x="32"
              y="32"
              width="32"
              height="32"
              rx="7"
              stroke="url(#ag-og-accent)"
              strokeWidth="5"
            />
            <circle cx="40" cy="40" r="3.5" fill={FG} />
            <circle cx="56" cy="40" r="3.5" fill={FG} />
            <circle cx="48" cy="48" r="3.5" fill={FG} />
            <circle cx="40" cy="56" r="3.5" fill={FG} />
            <circle cx="56" cy="56" r="3.5" fill={FG} />
          </svg>
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
              color: ACCENT,
              border: `2px solid ${ACCENT}`,
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
        <div style={{ display: "flex" }}>Verifiable on-chain</div>
        <div style={{ display: "flex", color: BORDER }}>•</div>
        <div style={{ display: "flex" }}>Non-custodial</div>
        <div style={{ display: "flex", color: BORDER }}>•</div>
        <div style={{ display: "flex" }}>Chainlink VRF</div>
      </div>
    </div>,
    { ...OG_SIZE }
  );
}
