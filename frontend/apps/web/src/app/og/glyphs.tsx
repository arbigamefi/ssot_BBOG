import * as React from "react";

export const OG_COLORS = {
  bg: "#070a0e",
  fg: "#f8fafc",
  muted: "#98a3b4",
  surface: "#111827",
  surface2: "#172032",
  border: "#263246",
  brand: "#8F6CF9",
  cyan: "#6EE7F9",
  green: "#52D4A6",
  red: "#FF5B6C",
  amber: "#F8C76B"
} as const;

type OgGlyphProps = {
  size?: number;
  tone?: OgTone;
};

export type OgTone = "brand" | "cyan" | "green" | "red" | "amber" | "muted";

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

export function getOgToneColor(tone: OgTone = "brand") {
  if (tone === "cyan") return OG_COLORS.cyan;
  if (tone === "green") return OG_COLORS.green;
  if (tone === "red") return OG_COLORS.red;
  if (tone === "amber") return OG_COLORS.amber;
  if (tone === "muted") return OG_COLORS.muted;
  return OG_COLORS.brand;
}

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

function DiceGlyph({ size, tone = "cyan" }: OgGlyphProps) {
  const accent = getOgToneColor(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <defs>
        <linearGradient id="og-dice-face" x1="78" y1="58" x2="284" y2="300">
          <stop stopColor={OG_COLORS.cyan} stopOpacity="0.92" />
          <stop offset="0.52" stopColor={OG_COLORS.brand} stopOpacity="0.9" />
          <stop offset="1" stopColor={OG_COLORS.surface} />
        </linearGradient>
        <linearGradient id="og-dice-side" x1="238" y1="92" x2="314" y2="262">
          <stop stopColor={accent} stopOpacity="0.88" />
          <stop offset="1" stopColor={OG_COLORS.surface2} />
        </linearGradient>
      </defs>
      <path d="M82 88 216 50 302 140 250 292 104 264 48 148Z" fill="#05070a" opacity="0.75" />
      <path d="M82 88 216 50 302 140 170 184 48 148Z" fill="url(#og-dice-face)" />
      <path d="M170 184 302 140 250 292 104 264Z" fill="url(#og-dice-side)" opacity="0.9" />
      <path d="M48 148 170 184 104 264Z" fill={OG_COLORS.surface2} />
      <path
        d="M82 88 216 50 302 140 250 292 104 264 48 148Z"
        stroke={OG_COLORS.cyan}
        strokeOpacity="0.48"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {[116, 176, 236].map((x, index) => (
        <circle
          key={x}
          cx={x}
          cy={index === 1 ? 118 : 146}
          r="10"
          fill={OG_COLORS.fg}
          opacity="0.85"
        />
      ))}
      <circle cx="182" cy="222" r="44" fill="#05070a" opacity="0.48" />
      <circle
        cx="182"
        cy="222"
        r="31"
        fill="none"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.58"
        strokeWidth="5"
      />
      <circle cx="182" cy="222" r="12" fill={OG_COLORS.fg} opacity="0.86" />
    </svg>
  );
}

function RouletteGlyph({ size }: OgGlyphProps) {
  const cx = 180;
  const cy = 188;
  const segments = 18;
  const outer = 132;
  const inner = 58;
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <circle cx={cx} cy={cy} r="150" fill="#05070a" />
      <circle cx={cx} cy={cy} r="148" stroke={OG_COLORS.border} strokeWidth="3" />
      {Array.from({ length: segments }).map((_, i) => {
        const a0 = (i / segments) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2 - Math.PI / 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const color = i === 0 ? OG_COLORS.green : i % 2 === 0 ? OG_COLORS.surface2 : OG_COLORS.red;
        const x0 = cx + outer * Math.cos(a0);
        const y0 = cy + outer * Math.sin(a0);
        const x1 = cx + outer * Math.cos(a1);
        const y1 = cy + outer * Math.sin(a1);
        const x2 = cx + inner * Math.cos(a1);
        const y2 = cy + inner * Math.sin(a1);
        const x3 = cx + inner * Math.cos(a0);
        const y3 = cy + inner * Math.sin(a0);
        return (
          <path
            key={i}
            d={`M ${x0} ${y0} A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`}
            fill={color}
            stroke={OG_COLORS.bg}
            strokeWidth="2"
          />
        );
      })}
      <circle cx={cx} cy={cy} r="74" fill={OG_COLORS.brand} />
      <circle cx={cx} cy={cy} r="40" fill={OG_COLORS.bg} />
      <circle cx={cx + 93} cy={cy - 96} r="11" fill={OG_COLORS.cyan} />
      <path
        d={`M ${cx - 54} ${cy} H ${cx + 54} M ${cx} ${cy - 54} V ${cy + 54}`}
        stroke={OG_COLORS.fg}
        strokeOpacity="0.32"
        strokeWidth="4"
      />
    </svg>
  );
}

function CoinTossGlyph({ size }: OgGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <g>
        <circle cx="146" cy="198" r="92" fill="#05070a" opacity="0.64" />
        <circle cx="138" cy="186" r="92" fill={OG_COLORS.brand} />
        <circle
          cx="138"
          cy="186"
          r="78"
          fill="none"
          stroke={OG_COLORS.fg}
          strokeOpacity="0.35"
          strokeWidth="5"
          strokeDasharray="2 10"
        />
        <circle
          cx="138"
          cy="186"
          r="44"
          fill="none"
          stroke={OG_COLORS.fg}
          strokeOpacity="0.6"
          strokeWidth="8"
        />
        <circle cx="138" cy="186" r="18" fill={OG_COLORS.fg} opacity="0.88" />
      </g>
      <g>
        <circle cx="230" cy="170" r="92" fill="#05070a" opacity="0.64" />
        <circle cx="222" cy="158" r="92" fill={OG_COLORS.cyan} />
        <circle
          cx="222"
          cy="158"
          r="78"
          fill="none"
          stroke={OG_COLORS.fg}
          strokeOpacity="0.35"
          strokeWidth="5"
          strokeDasharray="2 10"
        />
        <path
          d="M222 108 V208 M172 158 H272"
          stroke={OG_COLORS.fg}
          strokeOpacity="0.62"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M188 124 L256 192 M256 124 L188 192"
          stroke={OG_COLORS.fg}
          strokeOpacity="0.38"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M96 282 C142 318 224 318 274 276"
        stroke={OG_COLORS.green}
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

function KenoGlyph({ size }: OgGlyphProps) {
  const draws = [3, 7, 11, 15, 24, 31, 36, 40, 5, 18];
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <rect
        x="42"
        y="52"
        width="276"
        height="252"
        rx="34"
        fill="#070a0e"
        stroke={OG_COLORS.border}
        strokeWidth="4"
      />
      <circle
        cx="180"
        cy="136"
        r="64"
        fill={OG_COLORS.surface2}
        stroke={OG_COLORS.cyan}
        strokeOpacity="0.65"
        strokeWidth="4"
      />
      {draws.map((number, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        return (
          <circle
            key={number}
            cx={82 + col * 49}
            cy={226 + row * 42}
            r="18"
            fill={i < 5 ? OG_COLORS.brand : OG_COLORS.green}
          />
        );
      })}
      <path
        d="M138 136 H222 M180 94 V178"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.25"
        strokeWidth="4"
      />
    </svg>
  );
}

function PlinkoGlyph({ size }: OgGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <rect
        x="50"
        y="38"
        width="260"
        height="286"
        rx="32"
        fill="#070a0e"
        stroke={OG_COLORS.border}
        strokeWidth="4"
      />
      {Array.from({ length: 7 }).map((_, row) =>
        Array.from({ length: row + 4 }).map((__, col) => (
          <circle
            key={`${row}-${col}`}
            cx={92 + col * 34 - row * 16}
            cy={84 + row * 30}
            r="5.5"
            fill={OG_COLORS.fg}
            opacity="0.42"
          />
        ))
      )}
      <path
        d="M180 52 C130 102 238 128 178 176 C126 218 220 230 146 286"
        stroke={OG_COLORS.cyan}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="1 16"
      />
      <circle cx="180" cy="52" r="17" fill={OG_COLORS.green} />
      <circle cx="146" cy="286" r="22" fill={OG_COLORS.brand} />
      <rect x="72" y="298" width="216" height="22" rx="9" fill={OG_COLORS.surface2} />
      <rect x="132" y="298" width="54" height="22" rx="9" fill={OG_COLORS.green} />
    </svg>
  );
}

function SlotsGlyph({ size }: OgGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <rect
        x="48"
        y="72"
        width="264"
        height="214"
        rx="34"
        fill="#070a0e"
        stroke={OG_COLORS.border}
        strokeWidth="4"
      />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={76 + i * 76}
          y="104"
          width="58"
          height="118"
          rx="16"
          fill={OG_COLORS.surface2}
          stroke={OG_COLORS.brand}
          strokeOpacity="0.35"
          strokeWidth="3"
        />
      ))}
      {[76, 152, 228].map((x, i) => (
        <g key={x}>
          <circle
            cx={x + 29}
            cy="148"
            r={i === 1 ? "18" : "14"}
            fill={i === 1 ? OG_COLORS.amber : OG_COLORS.green}
          />
          <path
            d={`M ${x + 15} 182 H ${x + 43} M ${x + 19} 198 H ${x + 39}`}
            stroke={OG_COLORS.fg}
            strokeOpacity="0.72"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>
      ))}
      <path d="M82 244 H278" stroke={OG_COLORS.green} strokeWidth="8" strokeLinecap="round" />
      <circle cx="292" cy="116" r="18" fill={OG_COLORS.red} />
      <path d="M292 134 V210" stroke={OG_COLORS.red} strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

function BaccaratGlyph({ size }: OgGlyphProps) {
  const cards = [
    { x: 92, y: 82, color: OG_COLORS.bg, kind: "spade" },
    { x: 136, y: 104, color: OG_COLORS.red, kind: "diamond" },
    { x: 206, y: 82, color: OG_COLORS.bg, kind: "club" },
    { x: 250, y: 104, color: OG_COLORS.red, kind: "heart" }
  ] as const;
  const circles = [
    { cx: 110, cy: 244, color: OG_COLORS.cyan },
    { cx: 180, cy: 244, color: OG_COLORS.brand },
    { cx: 250, cy: 244, color: OG_COLORS.green }
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <rect
        x="42"
        y="70"
        width="276"
        height="220"
        rx="42"
        fill="#07110e"
        stroke={OG_COLORS.green}
        strokeOpacity="0.5"
        strokeWidth="4"
      />
      {cards.map(({ x, y, color, kind }) => (
        <g key={`${x}-${kind}`}>
          <rect x={x} y={y} width="54" height="78" rx="9" fill={OG_COLORS.fg} />
          {kind === "diamond" ? (
            <path
              d={`M ${x + 27} ${y + 18} L ${x + 43} ${y + 39} L ${x + 27} ${y + 60} L ${x + 11} ${y + 39} Z`}
              fill={color}
            />
          ) : null}
          {kind === "heart" ? (
            <path
              d={`M ${x + 27} ${y + 58} C ${x + 6} ${y + 40} ${x + 8} ${y + 20} ${x + 24} ${y + 25} C ${x + 27} ${y + 26} ${x + 27} ${y + 26} ${x + 30} ${y + 25} C ${x + 46} ${y + 20} ${x + 48} ${y + 40} ${x + 27} ${y + 58} Z`}
              fill={color}
            />
          ) : null}
          {kind === "spade" ? (
            <path
              d={`M ${x + 27} ${y + 18} C ${x + 8} ${y + 36} ${x + 10} ${y + 54} ${x + 25} ${y + 48} L ${x + 20} ${y + 62} H ${x + 34} L ${x + 29} ${y + 48} C ${x + 44} ${y + 54} ${x + 46} ${y + 36} ${x + 27} ${y + 18} Z`}
              fill={color}
            />
          ) : null}
          {kind === "club" ? (
            <g>
              <circle cx={x + 27} cy={y + 29} r="10" fill={color} />
              <circle cx={x + 17} cy={y + 43} r="10" fill={color} />
              <circle cx={x + 37} cy={y + 43} r="10" fill={color} />
              <path d={`M ${x + 27} ${y + 43} L ${x + 20} ${y + 62} H ${x + 34} Z`} fill={color} />
            </g>
          ) : null}
        </g>
      ))}
      {circles.map(({ cx, cy, color }) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy={cy}
            r="33"
            fill={color}
            fillOpacity="0.18"
            stroke={color}
            strokeWidth="3"
          />
          <circle cx={cx} cy={cy} r="13" fill={color} opacity="0.92" />
        </g>
      ))}
    </svg>
  );
}

function SicBoGlyph({ size }: OgGlyphProps) {
  const dice: Array<{ x: number; y: number; spots: Array<[number, number]> }> = [
    {
      x: 100,
      y: 190,
      spots: [
        [14, 14],
        [28, 28],
        [42, 42]
      ]
    },
    {
      x: 158,
      y: 202,
      spots: [
        [14, 14],
        [42, 14],
        [28, 28],
        [14, 42],
        [42, 42]
      ]
    },
    {
      x: 218,
      y: 190,
      spots: [
        [14, 14],
        [42, 14],
        [14, 28],
        [42, 28],
        [14, 42],
        [42, 42]
      ]
    }
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" fill="none">
      <path
        d="M78 112 C92 54 268 54 282 112 L258 184 C232 216 128 216 102 184Z"
        fill={OG_COLORS.surface2}
        stroke={OG_COLORS.cyan}
        strokeOpacity="0.55"
        strokeWidth="4"
      />
      <path
        d="M92 112 C110 138 250 138 268 112"
        stroke={OG_COLORS.fg}
        strokeOpacity="0.24"
        strokeWidth="5"
      />
      {dice.map(({ x, y, spots }) => (
        <g key={x}>
          <rect x={x} y={y} width="56" height="56" rx="12" fill={OG_COLORS.fg} />
          {spots.map(([cx, cy], i) => (
            <circle key={i} cx={x + cx} cy={y + cy} r="4.5" fill={OG_COLORS.bg} />
          ))}
        </g>
      ))}
      <rect x="72" y="284" width="216" height="34" rx="14" fill={OG_COLORS.surface2} />
      {[98, 140, 182, 224].map((x, i) => (
        <rect
          key={x}
          x={x}
          y="296"
          width={i === 1 ? "30" : "22"}
          height="10"
          rx="5"
          fill={i === 1 ? OG_COLORS.green : OG_COLORS.cyan}
          opacity="0.85"
        />
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
        fill="#07110e"
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
