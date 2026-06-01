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
const BRAND = "#8f6cf9";
const ACCENT = "#43efd2";
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
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: `linear-gradient(135deg, ${BRAND}, ${ACCENT})`
            }}
          />
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
            background: ACCENT
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
