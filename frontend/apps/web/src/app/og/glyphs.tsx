import * as React from "react";

import { OG_COLORS, type OgTone, getOgToneColor } from "./palette";

export { OG_COLORS, getOgToneColor };
export type { OgTone };

type OgGlyphProps = {
  size?: number;
  tone?: OgTone;
};

export type OgGlyphKind =
  | "casino"
  | "dice"
  | "coin-toss"
  | "roulette"
  | "keno"
  | "plinko"
  | "slots"
  | "baccarat"
  | "sic-bo"
  | "earn"
  | "affiliate"
  | "sportsbook"
  | "status"
  | "support"
  | "receipt";

export function OgGlyph({
  kind,
  size = 330,
  tone = "brand"
}: OgGlyphProps & { kind: OgGlyphKind }) {
  if (kind === "casino") return <CasinoGlyph size={size} />;
  if (kind === "dice") return <DiceGlyph size={size} tone={tone} />;
  if (kind === "coin-toss") return <CoinTossGlyph size={size} />;
  if (kind === "roulette") return <RouletteGlyph size={size} />;
  if (kind === "keno") return <KenoGlyph size={size} />;
  if (kind === "plinko") return <PlinkoGlyph size={size} />;
  if (kind === "slots") return <SlotsGlyph size={size} />;
  if (kind === "baccarat") return <BaccaratGlyph size={size} />;
  if (kind === "sic-bo") return <SicBoGlyph size={size} />;
  if (kind === "earn") return <EarnGlyph size={size} />;
  if (kind === "affiliate") return <AffiliateGlyph size={size} />;
  if (kind === "sportsbook") return <SportsbookGlyph size={size} />;
  if (kind === "status") return <StatusGlyph size={size} />;
  if (kind === "support") return <SupportGlyph size={size} />;
  return <ReceiptGlyph size={size} tone={tone} />;
}

function DiceGlyph({ size = 330, tone = "cyan" }: OgGlyphProps) {
  // Front face of the percentile die showing TARGET / 50 — mirrors the product
  // DiceMiniIcon. Text is overlaid as HTML (Satori does not rasterize <svg><text>).
  const edge = getOgToneColor(tone);
  return (
    <div style={{ position: "relative", display: "flex", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
        <defs>
          <linearGradient id="og-dice-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={OG_COLORS.diceFaceTop} />
            <stop offset="100%" stopColor={OG_COLORS.surface} />
          </linearGradient>
        </defs>
        {/* depth shadow + square die face */}
        <rect x="96" y="108" width="192" height="192" rx="34" fill={OG_COLORS.deep} opacity="0.6" />
        <rect
          x="72"
          y="84"
          width="192"
          height="192"
          rx="34"
          fill="url(#og-dice-face)"
          stroke={edge}
          strokeOpacity="0.62"
          strokeWidth="6"
        />
        {/* top sheen hairline (echoes the product IconFrame) */}
        <path d="M100 112 H236" stroke={OG_COLORS.fg} strokeOpacity="0.14" strokeWidth="3" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: "20%",
          top: "23.3%",
          width: "53.3%",
          height: "53.3%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: `${size * 0.01}px`
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: `${size * 0.072}px`,
            fontWeight: 700,
            letterSpacing: `${size * 0.016}px`,
            color: OG_COLORS.fg,
            opacity: 0.5
          }}
        >
          TARGET
        </div>
        <div
          style={{
            display: "flex",
            fontSize: `${size * 0.27}px`,
            fontWeight: 800,
            color: OG_COLORS.fg
          }}
        >
          50
        </div>
      </div>
    </div>
  );
}

function RouletteGlyph({ size }: OgGlyphProps) {
  // 12-pocket single-zero wheel with central cone + accent diamond pointer —
  // mirrors the product RouletteMiniIcon.
  const cx = 180;
  const cy = 188;
  const SEG = 12;
  const r0 = 66;
  const r1 = 126;
  const half = Math.PI / SEG;
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <defs>
        <radialGradient id="og-rou-cone" cx="40%" cy="34%" r="80%">
          <stop offset="0%" stopColor={OG_COLORS.fg} stopOpacity="0.5" />
          <stop offset="56%" stopColor={OG_COLORS.brand} />
          <stop offset="100%" stopColor={OG_COLORS.brandDark} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r1 + 12} fill={OG_COLORS.surface} />
      <circle
        cx={cx}
        cy={cy}
        r={r1 + 12}
        fill="none"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.18"
        strokeWidth="2"
      />
      {Array.from({ length: SEG }).map((_, i) => {
        const color = i === 0 ? OG_COLORS.green : i % 2 === 1 ? OG_COLORS.red : OG_COLORS.deep;
        const a0 = (i * Math.PI * 2) / SEG - Math.PI / 2 - half;
        const a1 = ((i + 1) * Math.PI * 2) / SEG - Math.PI / 2 - half;
        const x0 = cx + r1 * Math.cos(a0);
        const y0 = cy + r1 * Math.sin(a0);
        const x1 = cx + r1 * Math.cos(a1);
        const y1 = cy + r1 * Math.sin(a1);
        const x2 = cx + r0 * Math.cos(a1);
        const y2 = cy + r0 * Math.sin(a1);
        const x3 = cx + r0 * Math.cos(a0);
        const y3 = cy + r0 * Math.sin(a0);
        return (
          <path
            key={i}
            d={`M ${x0} ${y0} A ${r1} ${r1} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 0 0 ${x3} ${y3} Z`}
            fill={color}
            stroke={OG_COLORS.fg}
            strokeOpacity="0.18"
            strokeWidth="1.5"
          />
        );
      })}
      <circle
        cx={cx}
        cy={cy}
        r={r0 - 6}
        fill="url(#og-rou-cone)"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <circle cx={cx} cy={cy} r="11" fill={OG_COLORS.fg} opacity="0.95" />
      <rect
        x={cx - 15}
        y="30"
        width="30"
        height="30"
        rx="6"
        transform={`rotate(45 ${cx} 45)`}
        fill={OG_COLORS.cyan}
      />
    </svg>
  );
}

function CoinTossGlyph({ size = 330 }: OgGlyphProps) {
  // Two minted medallions with embossed H / T monograms — mirrors the product
  // CoinTossMiniIcon. Monograms overlaid as HTML for crisp text.
  return (
    <div style={{ position: "relative", display: "flex", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
        <defs>
          <radialGradient id="og-coin-t" cx="36%" cy="28%" r="82%">
            <stop offset="0%" stopColor={OG_COLORS.fg} stopOpacity="0.55" />
            <stop offset="46%" stopColor={OG_COLORS.cyan} />
            <stop offset="100%" stopColor={OG_COLORS.cyanDark} />
          </radialGradient>
          <radialGradient id="og-coin-h" cx="36%" cy="28%" r="82%">
            <stop offset="0%" stopColor={OG_COLORS.fg} stopOpacity="0.55" />
            <stop offset="46%" stopColor={OG_COLORS.brand} />
            <stop offset="100%" stopColor={OG_COLORS.brandDark} />
          </radialGradient>
        </defs>
        {/* T coin (behind, lower-right) */}
        <circle cx="252" cy="202" r="64" fill={OG_COLORS.deep} opacity="0.5" />
        <circle cx="246" cy="194" r="64" fill="url(#og-coin-t)" />
        <circle
          cx="246"
          cy="194"
          r="55"
          fill="none"
          stroke={OG_COLORS.deep}
          strokeOpacity="0.5"
          strokeWidth="9"
          strokeDasharray="4 8"
          strokeLinecap="round"
        />
        <circle
          cx="246"
          cy="194"
          r="40"
          fill="none"
          stroke={OG_COLORS.fg}
          strokeOpacity="0.28"
          strokeWidth="2"
        />
        {/* H coin (front, upper-left) */}
        <circle cx="146" cy="172" r="96" fill={OG_COLORS.deep} opacity="0.55" />
        <circle cx="138" cy="164" r="96" fill="url(#og-coin-h)" />
        <circle
          cx="138"
          cy="164"
          r="83"
          fill="none"
          stroke={OG_COLORS.deep}
          strokeOpacity="0.5"
          strokeWidth="13"
          strokeDasharray="5 10"
          strokeLinecap="round"
        />
        <circle
          cx="138"
          cy="164"
          r="62"
          fill="none"
          stroke={OG_COLORS.fg}
          strokeOpacity="0.28"
          strokeWidth="2.5"
        />
      </svg>
      {/* T monogram over the back coin */}
      <div
        style={{
          position: "absolute",
          left: `${(246 - 64) / 3.6}%`,
          top: `${(194 - 64) / 3.6}%`,
          width: `${128 / 3.6}%`,
          height: `${128 / 3.6}%`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: OG_COLORS.coinText,
          fontSize: `${size * 0.155}px`,
          fontWeight: 800
        }}
      >
        T
      </div>
      {/* H monogram over the front coin */}
      <div
        style={{
          position: "absolute",
          left: `${(138 - 96) / 3.6}%`,
          top: `${(164 - 96) / 3.6}%`,
          width: `${192 / 3.6}%`,
          height: `${192 / 3.6}%`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: OG_COLORS.fg,
          fontSize: `${size * 0.23}px`,
          fontWeight: 800
        }}
      >
        H
      </div>
    </div>
  );
}

function KenoGlyph({ size }: OgGlyphProps) {
  // Glass globe ball machine with brand balls and a chute — mirrors the product
  // KenoMiniIcon (was a flat number grid before).
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <defs>
        <radialGradient id="og-keno-glass" cx="40%" cy="28%" r="78%">
          <stop offset="0%" stopColor={OG_COLORS.surface2} />
          <stop offset="100%" stopColor={OG_COLORS.deep} />
        </radialGradient>
        <radialGradient id="og-keno-ball" cx="32%" cy="28%" r="80%">
          <stop offset="0%" stopColor={OG_COLORS.white} />
          <stop offset="70%" stopColor={OG_COLORS.brand} />
          <stop offset="100%" stopColor={OG_COLORS.brandDark} />
        </radialGradient>
      </defs>
      {/* housing ring */}
      <circle
        cx="168"
        cy="172"
        r="126"
        fill={OG_COLORS.surface}
        stroke={OG_COLORS.border}
        strokeWidth="4"
      />
      {/* glass cavity */}
      <circle cx="168" cy="172" r="104" fill="url(#og-keno-glass)" />
      {/* rim highlight */}
      <path
        d="M84 122 A104 104 0 0 1 234 84"
        fill="none"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.34"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* balls tumbling inside */}
      <circle cx="138" cy="206" r="26" fill="url(#og-keno-ball)" />
      <circle cx="188" cy="216" r="26" fill="url(#og-keno-ball)" />
      <circle cx="166" cy="160" r="26" fill="url(#og-keno-ball)" />
      <circle cx="210" cy="182" r="19" fill="url(#og-keno-ball)" />
      {/* chute toward the rack */}
      <rect
        x="286"
        y="156"
        width="48"
        height="27"
        rx="9"
        fill={OG_COLORS.surface}
        stroke={OG_COLORS.border}
        strokeWidth="3"
      />
    </svg>
  );
}

function PlinkoGlyph({ size }: OgGlyphProps) {
  // Peg triangle, a falling ball, and edge-hot multiplier buckets — mirrors the
  // product PlinkoMiniIcon.
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      {/* drop chute */}
      <rect
        x="165"
        y="30"
        width="30"
        height="21"
        rx="6"
        fill={OG_COLORS.surface2}
        stroke={OG_COLORS.fg}
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      {/* peg triangle (5 rows) */}
      {Array.from({ length: 5 }).flatMap((_, row) =>
        Array.from({ length: row + 1 }).map((__, i) => (
          <circle
            key={`${row}-${i}`}
            cx={180 + (i - row / 2) * 36}
            cy={84 + row * 33}
            r="7.8"
            fill={OG_COLORS.fg}
            opacity="0.78"
          />
        ))
      )}
      {/* ball mid-fall */}
      <circle cx="198" cy="214" r="15" fill={OG_COLORS.fg} />
      {/* multiplier buckets — edges hot */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const hot = i === 0 || i === 6;
        const mid = i === 3;
        return (
          <rect
            key={i}
            x={42 + i * 39}
            y="276"
            width="33"
            height="42"
            rx="9"
            fill={hot ? OG_COLORS.brand : mid ? OG_COLORS.surface2 : OG_COLORS.surface}
            stroke={OG_COLORS.fg}
            strokeOpacity="0.2"
            strokeWidth="1.5"
            opacity={hot ? 1 : 0.9}
          />
        );
      })}
    </svg>
  );
}

function SlotsGlyph({ size = 330 }: OgGlyphProps) {
  // Three-reel cabinet with a 7-7-7 line and an accent payline — mirrors the
  // product SlotsMiniIcon. Reel symbols overlaid as HTML text.
  const reelX = [72, 147, 222];
  return (
    <div style={{ position: "relative", display: "flex", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
        {/* cabinet */}
        <rect
          x="48"
          y="60"
          width="264"
          height="240"
          rx="30"
          fill={OG_COLORS.deep}
          stroke={OG_COLORS.fg}
          strokeOpacity="0.18"
          strokeWidth="3"
        />
        {/* marquee */}
        <rect x="60" y="72" width="240" height="30" rx="12" fill={OG_COLORS.surface2} />
        {/* reels */}
        {reelX.map((x) => (
          <rect
            key={x}
            x={x}
            y="120"
            width="66"
            height="156"
            rx="12"
            fill={OG_COLORS.surface}
            stroke={OG_COLORS.fg}
            strokeOpacity="0.14"
            strokeWidth="2.5"
          />
        ))}
        {/* payline */}
        <path
          d="M60 198 H300"
          stroke={OG_COLORS.cyan}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.95"
        />
        <circle cx="60" cy="198" r="7.5" fill={OG_COLORS.cyan} />
        <circle cx="300" cy="198" r="7.5" fill={OG_COLORS.cyan} />
      </svg>
      {reelX.map((x) => (
        <div
          key={x}
          style={{
            position: "absolute",
            left: `${x / 3.6}%`,
            top: `${120 / 3.6}%`,
            width: `${66 / 3.6}%`,
            height: `${156 / 3.6}%`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: OG_COLORS.fg,
            fontSize: `${size * 0.155}px`,
            fontWeight: 900
          }}
        >
          7
        </div>
      ))}
    </div>
  );
}

function BaccaratGlyph({ size }: OgGlyphProps) {
  // Two tilted cards (heart + spade) over a felt panel with three chips —
  // mirrors the product BaccaratMiniIcon.
  const chips = [
    { cx: 104, color: OG_COLORS.brand },
    { cx: 180, color: OG_COLORS.cyan },
    { cx: 256, color: OG_COLORS.green }
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      {/* felt panel */}
      <rect
        x="42"
        y="64"
        width="276"
        height="214"
        rx="42"
        fill={OG_COLORS.felt}
        stroke={OG_COLORS.green}
        strokeOpacity="0.5"
        strokeWidth="4"
      />
      {/* back card — heart */}
      <g transform="translate(98 92) rotate(-9)">
        <rect
          width="100"
          height="142"
          rx="14"
          fill={OG_COLORS.fg}
          stroke={OG_COLORS.ink}
          strokeOpacity="0.4"
          strokeWidth="2"
        />
        <path
          d="M50 104 C14 74 20 32 50 48 C50 48 50 48 50 48 C80 32 86 74 50 104 Z"
          fill={OG_COLORS.red}
        />
      </g>
      {/* front card — spade */}
      <g transform="translate(164 104) rotate(9)">
        <rect
          width="100"
          height="142"
          rx="14"
          fill={OG_COLORS.fg}
          stroke={OG_COLORS.ink}
          strokeOpacity="0.4"
          strokeWidth="2"
        />
        <path
          d="M50 40 C14 70 20 104 50 90 L40 116 H60 L50 90 C80 104 86 70 50 40 Z"
          fill={OG_COLORS.ink}
        />
      </g>
      {/* three chips */}
      {chips.map(({ cx, color }) => (
        <g key={cx}>
          <ellipse cx={cx} cy="266" rx="30" ry="9" fill={OG_COLORS.deep} opacity="0.5" />
          <circle
            cx={cx}
            cy="258"
            r="27"
            fill={color}
            stroke={OG_COLORS.fg}
            strokeOpacity="0.22"
            strokeWidth="2"
          />
          <circle
            cx={cx}
            cy="258"
            r="14"
            fill="none"
            stroke={OG_COLORS.fg}
            strokeOpacity="0.4"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        </g>
      ))}
    </svg>
  );
}

function SicBoGlyph({ size }: OgGlyphProps) {
  // Frosted dome cup lifting off three dice (2 / 5 / 6) — mirrors the product
  // SicBoMiniIcon.
  const dice: Array<{ x: number; y: number; rot: number; pips: Array<[number, number]> }> = [
    {
      x: 100,
      y: 196,
      rot: -8,
      pips: [
        [-15, -15],
        [15, 15]
      ]
    },
    {
      x: 180,
      y: 220,
      rot: 4,
      pips: [
        [-15, -15],
        [15, -15],
        [0, 0],
        [-15, 15],
        [15, 15]
      ]
    },
    {
      x: 262,
      y: 192,
      rot: 10,
      pips: [
        [-15, -18],
        [15, -18],
        [-15, 0],
        [15, 0],
        [-15, 18],
        [15, 18]
      ]
    }
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      {/* dome (cup) arcs */}
      <path
        d="M78 140 Q180 60 282 140"
        fill="none"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.3"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M92 140 Q180 86 268 140"
        fill="none"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.14"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {dice.map(({ x, y, rot, pips }) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <rect
            x="-42"
            y="-42"
            width="84"
            height="84"
            rx="18"
            fill={OG_COLORS.diceFace}
            stroke={OG_COLORS.border}
            strokeWidth="2"
          />
          {pips.map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r="6.6" fill={OG_COLORS.deep} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function EarnGlyph({ size }: OgGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <rect
        x="70"
        y="92"
        width="220"
        height="180"
        rx="34"
        fill={OG_COLORS.felt}
        stroke={OG_COLORS.green}
        strokeOpacity="0.6"
        strokeWidth="4"
      />
      <path
        d="M92 234 C126 204 146 220 174 182 C208 136 234 156 268 116"
        stroke={OG_COLORS.green}
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      {[114, 152, 190].map((x, i) => (
        <g key={x}>
          <ellipse
            cx={x + i * 24}
            cy={250 - i * 24}
            rx="33"
            ry="10"
            fill={OG_COLORS.cyan}
            opacity="0.86"
          />
          <rect
            x={x - 33 + i * 24}
            y={212 - i * 24}
            width="66"
            height="38"
            fill={OG_COLORS.brand}
            opacity="0.7"
          />
          <ellipse cx={x + i * 24} cy={212 - i * 24} rx="33" ry="10" fill={OG_COLORS.brand} />
        </g>
      ))}
      <circle cx="276" cy="114" r="14" fill={OG_COLORS.green} />
    </svg>
  );
}

function AffiliateGlyph({ size }: OgGlyphProps) {
  const nodes = [
    { cx: 96, cy: 176, color: OG_COLORS.green, shape: "link" },
    { cx: 202, cy: 98, color: OG_COLORS.brand, shape: "chip" },
    { cx: 250, cy: 240, color: OG_COLORS.cyan, shape: "stack" }
  ] as const;
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      {nodes.map(({ cx, cy, color, shape }) => (
        <g key={shape}>
          <circle
            cx={cx}
            cy={cy}
            r="54"
            fill={color}
            fillOpacity="0.18"
            stroke={color}
            strokeWidth="4"
          />
          {shape === "link" ? (
            <path
              d="M74 184 C86 162 106 162 118 184"
              stroke={OG_COLORS.fg}
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
          {shape === "chip" ? (
            <g>
              <circle cx={cx} cy={cy} r="23" fill={OG_COLORS.fg} opacity="0.9" />
              <circle cx={cx} cy={cy} r="10" fill={color} />
            </g>
          ) : null}
          {shape === "stack" ? (
            <g>
              <ellipse cx={cx} cy={cy - 14} rx="24" ry="8" fill={OG_COLORS.fg} opacity="0.9" />
              <rect
                x={cx - 24}
                y={cy - 14}
                width="48"
                height="26"
                fill={OG_COLORS.fg}
                opacity="0.76"
              />
              <ellipse cx={cx} cy={cy + 12} rx="24" ry="8" fill={OG_COLORS.fg} opacity="0.9" />
            </g>
          ) : null}
        </g>
      ))}
      <path
        d="M125 160 C150 118 164 104 176 100"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.35"
        strokeWidth="5"
        fill="none"
      />
      <path
        d="M210 128 C224 164 240 188 244 208"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.35"
        strokeWidth="5"
        fill="none"
      />
      <path
        d="M220 238 C164 242 130 220 112 202"
        stroke={OG_COLORS.green}
        strokeWidth="7"
        fill="none"
      />
    </svg>
  );
}

function SportsbookGlyph({ size }: OgGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <rect
        x="58"
        y="76"
        width="244"
        height="208"
        rx="30"
        fill={OG_COLORS.surface}
        stroke={OG_COLORS.border}
        strokeWidth="4"
      />
      <circle cx="130" cy="150" r="42" fill={OG_COLORS.fg} />
      <path d="M130 108 166 134 152 178 108 178 94 134Z" fill={OG_COLORS.bg} />
      <path
        d="M200 124 H270 M200 166 H270 M200 208 H270"
        stroke={OG_COLORS.cyan}
        strokeWidth="8"
        strokeLinecap="round"
      />
      {[90, 142, 194].map((x, i) => (
        <rect
          key={x}
          x={x}
          y="234"
          width="40"
          height="24"
          rx="9"
          fill={i === 1 ? OG_COLORS.green : OG_COLORS.surface2}
          stroke={OG_COLORS.green}
          strokeOpacity="0.7"
          strokeWidth="3"
        />
      ))}
    </svg>
  );
}

function StatusGlyph({ size }: OgGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <circle
        cx="180"
        cy="180"
        r="120"
        fill={OG_COLORS.surface}
        stroke={OG_COLORS.border}
        strokeWidth="4"
      />
      <circle cx="180" cy="180" r="80" fill="none" stroke={OG_COLORS.border} strokeWidth="3" />
      <path
        d="M180 180 L180 88 M180 180 L262 222 M180 180 L104 238"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.3"
        strokeWidth="4"
      />
      <circle cx="180" cy="88" r="18" fill={OG_COLORS.green} />
      <circle cx="262" cy="222" r="18" fill={OG_COLORS.cyan} />
      <circle cx="104" cy="238" r="18" fill={OG_COLORS.brand} />
      <path
        d="M148 178 171 202 214 154"
        stroke={OG_COLORS.fg}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SupportGlyph({ size }: OgGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <rect
        x="68"
        y="78"
        width="224"
        height="178"
        rx="30"
        fill={OG_COLORS.surface}
        stroke={OG_COLORS.border}
        strokeWidth="4"
      />
      <path
        d="M116 144 C118 104 242 104 244 144 C246 190 204 188 194 218"
        stroke={OG_COLORS.cyan}
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="190" cy="252" r="12" fill={OG_COLORS.brand} />
      <path d="M100 286 H260" stroke={OG_COLORS.green} strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptGlyph({ size, tone = "green" }: OgGlyphProps) {
  const color = getOgToneColor(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <rect
        x="72"
        y="52"
        width="216"
        height="256"
        rx="28"
        fill={OG_COLORS.surface}
        stroke={OG_COLORS.border}
        strokeWidth="4"
      />
      <path
        d="M106 112 H254 M106 158 H254 M106 204 H210"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.34"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle
        cx="242"
        cy="232"
        r="42"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="5"
      />
      <path
        d="M222 232 238 248 268 214"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CasinoGlyph({ size }: OgGlyphProps) {
  const item = 136;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width: size,
        height: size,
        gap: "16px",
        transform: "rotate(-3deg)"
      }}
    >
      <div style={{ display: "flex", width: item, height: item }}>
        <DiceGlyph size={item} />
      </div>
      <div style={{ display: "flex", width: item, height: item }}>
        <RouletteGlyph size={item} />
      </div>
      <div style={{ display: "flex", width: item, height: item }}>
        <PlinkoGlyph size={item} />
      </div>
      <div style={{ display: "flex", width: item, height: item }}>
        <SlotsGlyph size={item} />
      </div>
    </div>
  );
}
