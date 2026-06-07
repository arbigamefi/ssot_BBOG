import * as React from "react";

type GameMiniIconProps = {
  className?: string;
};

type CasinoGameMarkProps = GameMiniIconProps & {
  slug: string;
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Shared icon frame — matches the rebuilt game consoles: gradient `surface`
 * panel with a top sheen hairline and a soft brand bloom behind the mark.
 * Every game mark below is sized to ~80% of the frame so the bloom rings the
 * silhouette without crowding it.
 */
function IconFrame({ className, children }: React.PropsWithChildren<GameMiniIconProps>) {
  return (
    <div
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border-soft text-brand shadow-e2",
        className ?? "h-32 w-32"
      )}
      style={{
        background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.18), transparent 70%)" }}
      />
      <div className="relative z-10 flex h-full w-full items-center justify-center">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dice — front face of the percentile die, showing TARGET / 50.              */
/* -------------------------------------------------------------------------- */

export function DiceMiniIcon({ className }: GameMiniIconProps) {
  const uid = React.useId();
  const fillId = `dice-face-${uid}`;
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[80%] w-[80%]">
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--surface-3))" />
            <stop offset="100%" stopColor="hsl(var(--surface-1))" />
          </linearGradient>
        </defs>
        {/* depth shadow */}
        <rect
          x="28"
          y="32"
          width="68"
          height="68"
          rx="12"
          fill="hsl(var(--surface-0))"
          opacity="0.55"
        />
        {/* front face */}
        <rect
          x="22"
          y="24"
          width="68"
          height="68"
          rx="12"
          fill={`url(#${fillId})`}
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="2.5"
        />
        <text
          x="56"
          y="46"
          textAnchor="middle"
          fill="hsl(var(--fg))"
          fillOpacity="0.55"
          fontSize="9"
          fontFamily={MONO}
          fontWeight="700"
          letterSpacing="2"
        >
          TARGET
        </text>
        <text
          x="56"
          y="78"
          textAnchor="middle"
          fill="hsl(var(--fg))"
          fontSize="32"
          fontFamily={MONO}
          fontWeight="800"
        >
          50
        </text>
      </svg>
    </IconFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Roulette — 12-segment wheel with central cone and accent pointer.          */
/* -------------------------------------------------------------------------- */

export function RouletteMiniIcon({ className }: GameMiniIconProps) {
  const uid = React.useId();
  const coneId = `rou-cone-${uid}`;
  const centerX = 60;
  const centerY = 62;
  const SEG = 12;
  const r0 = 22; // inner edge of pocket ring
  const r1 = 42; // outer edge of pocket ring
  // top segment = green zero; the rest alternate red / black.
  const colors = Array.from({ length: SEG }, (_, i) =>
    i === 0 ? "hsl(var(--success))" : i % 2 === 1 ? "hsl(var(--danger))" : "hsl(var(--surface-0))"
  );
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[82%] w-[82%]">
        <defs>
          <radialGradient id={coneId} cx="40%" cy="34%" r="80%">
            <stop offset="0%" stopColor="hsl(var(--fg) / 0.5)" />
            <stop offset="56%" stopColor="hsl(var(--brand))" />
            <stop offset="100%" stopColor="hsl(var(--brand-active))" />
          </radialGradient>
        </defs>
        {/* apron */}
        <circle cx={centerX} cy={centerY} r={r1 + 4} fill="hsl(var(--surface-3))" />
        <circle
          cx={centerX}
          cy={centerY}
          r={r1 + 4}
          fill="none"
          stroke="hsl(var(--fg) / 0.18)"
          strokeWidth="1.5"
        />
        {/* pockets — donut segments */}
        {colors.map((color, i) => {
          const half = (Math.PI * 2) / SEG / 2;
          const a0 = (i * Math.PI * 2) / SEG - Math.PI / 2 - half;
          const a1 = ((i + 1) * Math.PI * 2) / SEG - Math.PI / 2 - half;
          const x0 = centerX + r1 * Math.cos(a0);
          const y0 = centerY + r1 * Math.sin(a0);
          const x1 = centerX + r1 * Math.cos(a1);
          const y1 = centerY + r1 * Math.sin(a1);
          const x2 = centerX + r0 * Math.cos(a1);
          const y2 = centerY + r0 * Math.sin(a1);
          const x3 = centerX + r0 * Math.cos(a0);
          const y3 = centerY + r0 * Math.sin(a0);
          return (
            <path
              key={i}
              d={`M ${x0} ${y0} A ${r1} ${r1} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 0 0 ${x3} ${y3} Z`}
              fill={color}
              stroke="hsl(var(--fg) / 0.18)"
              strokeWidth="0.6"
            />
          );
        })}
        {/* central cone */}
        <circle
          cx={centerX}
          cy={centerY}
          r={r0 - 2}
          fill={`url(#${coneId})`}
          stroke="hsl(var(--fg) / 0.2)"
          strokeWidth="1"
        />
        <circle cx={centerX} cy={centerY} r="3.5" fill="hsl(var(--fg))" opacity="0.95" />
        {/* pointer diamond — accent */}
        <rect
          x={centerX - 5}
          y="10"
          width="10"
          height="10"
          rx="2"
          transform={`rotate(45 ${centerX} 15)`}
          fill="hsl(var(--accent))"
        />
      </svg>
    </IconFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Coin Toss — two minted medallions (H brand, T accent) overlapping.         */
/* -------------------------------------------------------------------------- */

function MintedCoin({
  cx,
  cy,
  r,
  letter,
  tone,
  uid
}: {
  cx: number;
  cy: number;
  r: number;
  letter: "H" | "T";
  tone: "brand" | "accent";
  uid: string;
}) {
  const metalId = `coin-metal-${uid}-${letter}`;
  const toneVar = tone === "brand" ? "var(--brand)" : "var(--accent)";
  const toneDeep = tone === "brand" ? "var(--brand-active)" : "var(--accent)";
  const fontSize = r * 1.0;
  return (
    <g>
      <defs>
        <radialGradient id={metalId} cx="36%" cy="28%" r="82%">
          <stop offset="0%" stopColor="hsl(var(--fg) / 0.55)" />
          <stop offset="46%" stopColor={`hsl(${toneVar})`} />
          <stop offset="100%" stopColor={`hsl(${toneDeep} / 0.85)`} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${metalId})`} />
      {/* milled rim */}
      <circle
        cx={cx}
        cy={cy}
        r={r - 4}
        fill="none"
        stroke="hsl(var(--surface-0) / 0.55)"
        strokeWidth={r * 0.16}
        strokeDasharray="1.6 2.9"
        strokeLinecap="round"
      />
      {/* bevel ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r - 10}
        fill="none"
        stroke="hsl(var(--fg) / 0.28)"
        strokeWidth="0.8"
      />
      {/* embossed monogram (dark drop + bright top) */}
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="800"
        fontFamily={MONO}
        fill="hsl(var(--surface-0) / 0.5)"
      >
        {letter}
      </text>
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="800"
        fontFamily={MONO}
        fill="hsl(var(--fg) / 0.94)"
      >
        {letter}
      </text>
    </g>
  );
}

export function CoinTossMiniIcon({ className }: GameMiniIconProps) {
  const uid = React.useId();
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        {/* T coin (behind, lower-right) */}
        <MintedCoin cx={78} cy={74} r={26} letter="T" tone="accent" uid={uid} />
        {/* H coin (front, upper-left) */}
        <MintedCoin cx={48} cy={50} r={34} letter="H" tone="brand" uid={uid} />
      </svg>
    </IconFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Keno — glass globe with brand balls inside; chute hint.                    */
/* -------------------------------------------------------------------------- */

export function KenoMiniIcon({ className }: GameMiniIconProps) {
  const uid = React.useId();
  const glassId = `keno-glass-${uid}`;
  const ballId = `keno-ball-${uid}`;
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        <defs>
          <radialGradient id={glassId} cx="40%" cy="28%" r="78%">
            <stop offset="0%" stopColor="hsl(var(--surface-2))" />
            <stop offset="100%" stopColor="hsl(var(--surface-0))" />
          </radialGradient>
          <radialGradient id={ballId} cx="32%" cy="28%">
            <stop offset="0%" stopColor="white" />
            <stop offset="70%" stopColor="hsl(var(--brand))" />
            <stop offset="100%" stopColor="hsl(var(--brand-active))" />
          </radialGradient>
        </defs>
        {/* housing ring */}
        <circle cx="56" cy="56" r="42" fill="hsl(var(--surface-3))" />
        {/* glass cavity */}
        <circle cx="56" cy="56" r="35" fill={`url(#${glassId})`} />
        {/* rim highlight */}
        <path
          d="M 28 38 A 35 35 0 0 1 78 26"
          fill="none"
          stroke="hsl(var(--fg) / 0.34)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* balls inside */}
        <circle cx="46" cy="68" r="8" fill={`url(#${ballId})`} />
        <circle cx="62" cy="72" r="8" fill={`url(#${ballId})`} />
        <circle cx="55" cy="54" r="8" fill={`url(#${ballId})`} />
        <circle cx="69" cy="60" r="6" fill={`url(#${ballId})`} />
        {/* chute toward the rack */}
        <rect
          x="96"
          y="52"
          width="16"
          height="9"
          rx="3"
          fill="hsl(var(--surface-3))"
          stroke="hsl(var(--fg) / 0.18)"
          strokeWidth="1"
        />
      </svg>
    </IconFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Plinko — five rows of pegs, a falling ball, and edge-hot buckets.          */
/* -------------------------------------------------------------------------- */

export function PlinkoMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[86%] w-[86%]">
        {/* drop chute */}
        <rect
          x="55"
          y="10"
          width="10"
          height="7"
          rx="2"
          fill="hsl(var(--surface-3))"
          stroke="hsl(var(--fg) / 0.2)"
          strokeWidth="0.8"
        />
        {/* peg triangle (5 rows) */}
        {Array.from({ length: 5 }).flatMap((_, row) =>
          Array.from({ length: row + 1 }).map((__, i) => (
            <circle
              key={`peg-${row}-${i}`}
              cx={60 + (i - row / 2) * 12}
              cy={28 + row * 11}
              r="2.6"
              fill="hsl(var(--fg))"
              opacity="0.78"
            />
          ))
        )}
        {/* ball mid-fall */}
        <circle cx="66" cy="70" r="5" fill="hsl(var(--fg))" />
        {/* multiplier buckets (7 across) */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const x = 14 + i * 13;
          const hot = i === 0 || i === 6;
          const mid = i === 3;
          return (
            <rect
              key={`bucket-${i}`}
              x={x}
              y="92"
              width="11"
              height="14"
              rx="3"
              fill={hot ? "currentColor" : mid ? "hsl(var(--surface-2))" : "hsl(var(--surface-1))"}
              stroke="hsl(var(--fg) / 0.2)"
              strokeWidth="0.6"
              opacity={hot ? 1 : 0.85}
            />
          );
        })}
      </svg>
    </IconFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Slots — three reels with a 7-7-7 jackpot and an accent payline.            */
/* -------------------------------------------------------------------------- */

export function SlotsMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        {/* cabinet / recess */}
        <rect
          x="16"
          y="20"
          width="88"
          height="80"
          rx="10"
          fill="hsl(var(--surface-0))"
          stroke="hsl(var(--fg) / 0.18)"
          strokeWidth="1.5"
        />
        {/* marquee */}
        <rect x="20" y="24" width="80" height="10" rx="4" fill="hsl(var(--surface-2))" />
        {/* three reels */}
        {[0, 1, 2].map((i) => (
          <g key={`reel-${i}`} transform={`translate(${24 + i * 25} 40)`}>
            <rect
              width="22"
              height="52"
              rx="4"
              fill="hsl(var(--surface-1))"
              stroke="hsl(var(--fg) / 0.14)"
              strokeWidth="1"
            />
            <text
              x="11"
              y="36"
              textAnchor="middle"
              fontSize="22"
              fontWeight="900"
              fontFamily={MONO}
              fill="currentColor"
            >
              7
            </text>
          </g>
        ))}
        {/* payline */}
        <line
          x1="20"
          y1="66"
          x2="100"
          y2="66"
          stroke="hsl(var(--accent))"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.95"
        />
        <circle cx="20" cy="66" r="2.5" fill="hsl(var(--accent))" />
        <circle cx="100" cy="66" r="2.5" fill="hsl(var(--accent))" />
      </svg>
    </IconFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Baccarat — two tilted playing cards and a row of chips.                    */
/* -------------------------------------------------------------------------- */

export function BaccaratMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        {/* back card */}
        <g transform="translate(34 24) rotate(-9)">
          <rect
            width="34"
            height="48"
            rx="5"
            fill="hsl(var(--fg))"
            stroke="hsl(var(--fg) / 0.25)"
            strokeWidth="1"
          />
          <text
            x="6"
            y="13"
            fontSize="10"
            fontFamily={MONO}
            fontWeight="700"
            fill="hsl(var(--surface-0))"
          >
            K
          </text>
          {/* heart suit */}
          <path
            d="M17 30c-3-5-10-4-10 1 0 5 10 10 10 13 0-3 10-8 10-13 0-5-7-6-10-1Z"
            fill="hsl(var(--danger))"
          />
        </g>
        {/* front card */}
        <g transform="translate(54 28) rotate(8)">
          <rect
            width="34"
            height="48"
            rx="5"
            fill="hsl(var(--fg))"
            stroke="hsl(var(--fg) / 0.25)"
            strokeWidth="1"
          />
          <text
            x="6"
            y="13"
            fontSize="10"
            fontFamily={MONO}
            fontWeight="700"
            fill="hsl(var(--surface-0))"
          >
            A
          </text>
          {/* spade suit */}
          <path
            d="M17 18c4 5 10 8 10 13 0 4-4 6-8 4l1 5h-6l1-5c-4 2-8 0-8-4 0-5 6-8 10-13Z"
            fill="hsl(var(--surface-0))"
          />
        </g>
        {/* three chips */}
        {[0, 1, 2].map((i) => {
          const cxv = 30 + i * 28;
          const fill =
            i === 0 ? "currentColor" : i === 1 ? "hsl(var(--accent))" : "hsl(var(--surface-3))";
          return (
            <g key={`chip-${i}`}>
              <ellipse cx={cxv} cy={98} rx="11" ry="3" fill="hsl(var(--surface-0))" opacity="0.5" />
              <circle
                cx={cxv}
                cy="96"
                r="9.5"
                fill={fill}
                stroke="hsl(var(--fg) / 0.22)"
                strokeWidth="1"
              />
              <circle
                cx={cxv}
                cy="96"
                r="5"
                fill="none"
                stroke="hsl(var(--fg) / 0.35)"
                strokeWidth="0.9"
                strokeDasharray="2 1.5"
              />
            </g>
          );
        })}
      </svg>
    </IconFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Sic Bo — three dice cluster under a dome arc.                              */
/* -------------------------------------------------------------------------- */

type SicBoDieValue = 2 | 5 | 6;

const SIC_BO_PIPS: Record<SicBoDieValue, Array<[number, number]>> = {
  2: [
    [-5, -5],
    [5, 5]
  ],
  5: [
    [-5, -5],
    [5, -5],
    [0, 0],
    [-5, 5],
    [5, 5]
  ],
  6: [
    [-5, -6],
    [5, -6],
    [-5, 0],
    [5, 0],
    [-5, 6],
    [5, 6]
  ]
};

export function SicBoMiniIcon({ className }: GameMiniIconProps) {
  const dice = [
    { x: 32, y: 64, v: 2 as const, rot: -8 },
    { x: 60, y: 72, v: 5 as const, rot: 4 },
    { x: 88, y: 62, v: 6 as const, rot: 10 }
  ];
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        {/* dome (cup) arc — the frosted bowl that lifts away */}
        <path
          d="M 26 46 Q 60 22 94 46"
          fill="none"
          stroke="hsl(var(--fg) / 0.28)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 30 46 Q 60 30 90 46"
          fill="none"
          stroke="hsl(var(--fg) / 0.14)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        {dice.map((d, i) => (
          <g key={`die-${i}`} transform={`translate(${d.x} ${d.y}) rotate(${d.rot})`}>
            <rect
              x="-14"
              y="-14"
              width="28"
              height="28"
              rx="6"
              fill="hsl(var(--surface-3))"
              stroke="hsl(var(--fg) / 0.22)"
              strokeWidth="1"
            />
            {SIC_BO_PIPS[d.v].map(([px, py], j) => (
              <circle key={j} cx={px} cy={py} r="2.2" fill="hsl(var(--fg))" opacity="0.92" />
            ))}
          </g>
        ))}
      </svg>
    </IconFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Dispatcher — used by the casino list page and the home directory.          */
/* -------------------------------------------------------------------------- */

export function CasinoGameMark({ slug, className }: CasinoGameMarkProps) {
  switch (slug) {
    case "dice":
      return <DiceMiniIcon className={className} />;
    case "roulette":
      return <RouletteMiniIcon className={className} />;
    case "coin-toss":
      return <CoinTossMiniIcon className={className} />;
    case "keno":
      return <KenoMiniIcon className={className} />;
    case "plinko":
      return <PlinkoMiniIcon className={className} />;
    case "slots":
      return <SlotsMiniIcon className={className} />;
    case "baccarat":
      return <BaccaratMiniIcon className={className} />;
    case "sic-bo":
      return <SicBoMiniIcon className={className} />;
    default:
      return null;
  }
}
