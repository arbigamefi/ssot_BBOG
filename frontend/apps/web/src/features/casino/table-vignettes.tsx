import * as React from "react";

import type { CasinoModuleSlug } from "./modules";
import { EUROPEAN_WHEEL_ORDER, RED_NUMBER_SET } from "./room/model";

// Each lobby table's piece, drawn at rest on a 240 × 160 felt (lobby concept v1): the coins, the
// dice lane, the wheel, the cards, the dice under their dome, the reels, the pin board and the
// blower. Every colour is a table token; the shared gradients are defined once by
// <TableVignetteDefs /> and referenced by id.

/** A table token as a colour, optionally with alpha. */
const tk = (token: string, alpha?: number) =>
  alpha == null ? `hsl(var(--${token}))` : `hsl(var(--${token}) / ${alpha})`;
const fill = (token: string, alpha?: number): React.CSSProperties => ({ fill: tk(token, alpha) });
const stroke = (token: string, alpha?: number): React.CSSProperties => ({
  fill: "none",
  stroke: tk(token, alpha)
});
/** A gradient defined in <TableVignetteDefs />. */
const paint = (id: string): React.CSSProperties => ({ fill: `url(#lobby-${id})` });

// The coin's and the cards' lacquer red, lit and shaded the way the coin toss room mixes it.
const RED_HI = "color-mix(in srgb, hsl(var(--pocket-red)) 72%, hsl(var(--ivory-hi)))";
const RED_LO = "color-mix(in srgb, hsl(var(--pocket-red)) 62%, hsl(var(--rail-lo)))";

const SHADE: React.CSSProperties = { fill: tk("table-shade", 0.45), filter: "url(#lobby-blur)" };
const PAPER_FAINT = tk("paper", 0.24);
const PAPER_SOFT = tk("paper", 0.6);

const r2 = (n: number) => Number(n.toFixed(2));
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r2(cx + Math.cos(a) * r), r2(cy + Math.sin(a) * r)];
};

function Stop({ at, color }: { at: number; color: string }) {
  return <stop offset={at} style={{ stopColor: color }} />;
}

/** The gradients, pattern and blur every vignette shares. Render once per page. */
export function TableVignetteDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="lobby-ivory" cx=".36" cy=".3" r=".8">
          <Stop at={0} color={tk("ivory-hi")} />
          <Stop at={0.6} color={tk("ivory")} />
          <Stop at={1} color={tk("ivory-lo")} />
        </radialGradient>
        <radialGradient id="lobby-red" cx=".36" cy=".3" r=".8">
          <Stop at={0} color={RED_HI} />
          <Stop at={0.6} color={tk("pocket-red")} />
          <Stop at={1} color={RED_LO} />
        </radialGradient>
        <linearGradient id="lobby-groove" x1="0" y1="0" x2="0" y2="1">
          <Stop at={0} color={tk("groove-lo")} />
          <Stop at={1} color={tk("groove-hi")} />
        </linearGradient>
        <radialGradient id="lobby-dish" cx=".5" cy=".42" r=".6">
          <Stop at={0} color={tk("groove-hi")} />
          <Stop at={1} color={tk("groove-lo")} />
        </radialGradient>
        <linearGradient id="lobby-rail" x1="0" y1="0" x2="0" y2="1">
          <Stop at={0} color={tk("rail-hi")} />
          <Stop at={0.35} color={tk("rail")} />
          <Stop at={1} color={tk("rail-lo")} />
        </linearGradient>
        <linearGradient id="lobby-chrome" x1="0" y1="0" x2="0" y2="1">
          <Stop at={0} color={tk("ivory-hi")} />
          <Stop at={0.45} color={tk("ivory-lo")} />
          <Stop at={0.55} color={tk("faded")} />
          <Stop at={1} color={tk("ivory-lo")} />
        </linearGradient>
        <linearGradient id="lobby-reel" x1="0" y1="0" x2="0" y2="1">
          <Stop at={0} color={tk("ivory-lo")} />
          <Stop at={0.3} color={tk("ivory-hi")} />
          <Stop at={0.7} color={tk("ivory-hi")} />
          <Stop at={1} color={tk("ivory-lo")} />
        </linearGradient>
        <radialGradient id="lobby-glass" cx=".5" cy=".5" r=".5">
          <Stop at={0.6} color={tk("table-sheen", 0.04)} />
          <Stop at={0.93} color={tk("table-sheen", 0.16)} />
          <Stop at={1} color={tk("table-sheen", 0.05)} />
        </radialGradient>
        <pattern
          id="lobby-lattice"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" style={fill("ink")} />
          <path d="M0 0H7M0 0V7" strokeWidth="1" style={stroke("paper", 0.3)} />
        </pattern>
        <filter id="lobby-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
    </svg>
  );
}

function Ball({ x, y, r, red, n }: { x: number; y: number; r: number; red?: boolean; n?: number }) {
  return (
    <>
      <circle cx={x + 2} cy={y + 3} r={r} style={SHADE} />
      <circle cx={x} cy={y} r={r} style={paint(red ? "red" : "ivory")} />
      {n ? (
        <text
          x={x}
          y={y}
          className="font-text font-extrabold"
          fontSize="9"
          textAnchor="middle"
          dominantBaseline="central"
          style={fill(red ? "paper" : "carbon")}
        >
          {n}
        </text>
      ) : null}
    </>
  );
}

function Coin() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const p = (rr: number, da: number) =>
      `${r2(100 + Math.cos(a + da) * rr)} ${r2(74 + Math.sin(a + da) * rr)}`;
    return `M${p(9.5 * 1.4, -0.14)} L${p(9.5 * 2.25, 0)} L${p(9.5 * 1.4, 0.14)} Z`;
  }).join(" ");
  return (
    <>
      <circle
        cx="120"
        cy="82"
        r="68"
        strokeWidth="1.2"
        strokeDasharray="3 4"
        style={stroke("paper", 0.6)}
      />
      <mask id="lobby-moon" maskUnits="userSpaceOnUse">
        <rect width="240" height="160" fill="white" />
        <circle cx="163" cy="93" r="12" fill="black" />
      </mask>
      <circle cx="160" cy="106" r="38" style={SHADE} />
      <circle cx="156" cy="103" r="38" style={{ fill: RED_LO }} />
      <circle cx="156" cy="98" r="38" style={paint("red")} />
      <circle cx="156" cy="98" r="34" strokeWidth="1.5" style={stroke("ivory-hi")} />
      <circle cx="156" cy="98" r="15" mask="url(#lobby-moon)" style={fill("ivory-hi")} />
      <circle cx="104" cy="86" r="44" style={SHADE} />
      <circle cx="100" cy="80" r="44" style={fill("ivory-lo")} />
      <circle cx="100" cy="74" r="44" style={paint("ivory")} />
      <circle cx="100" cy="74" r="40" strokeWidth="1.6" style={stroke("ink")} />
      <circle
        cx="100"
        cy="74"
        r="35"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0 4.6"
        style={stroke("ink")}
      />
      <circle cx="100" cy="74" r="9.5" style={fill("ink")} />
      <path d={rays} style={fill("ink")} />
    </>
  );
}

function Dice() {
  const label = (x: number, text: string) => (
    <text
      x={x}
      y="128"
      className="font-text font-semibold"
      fontSize="8"
      textAnchor="middle"
      style={{ fill: PAPER_SOFT }}
    >
      {text}
    </text>
  );
  return (
    <>
      <rect x="18" y="60" width="204" height="44" rx="22" style={paint("groove")} />
      <rect x="18" y="60" width="204" height="44" rx="22" style={stroke("paper", 0.14)} />
      <rect x="24" y="66" width="96" height="32" rx="16" style={fill("paper", 0.08)} />
      {Array.from({ length: 11 }, (_, i) => (
        <line
          key={i}
          x1={30 + i * 18}
          y1="108"
          x2={30 + i * 18}
          y2={i % 5 ? 112 : 116}
          strokeWidth="1"
          style={{ stroke: PAPER_SOFT }}
        />
      ))}
      {label(30, "0")}
      {label(120, "50")}
      {label(210, "100")}
      <rect x="119" y="40" width="8" height="70" rx="3" style={SHADE} />
      <rect x="117" y="54" width="6" height="56" rx="3" style={fill("paper")} />
      <rect x="103" y="34" width="34" height="20" rx="5" style={fill("paper")} />
      <text
        x="120"
        y="44.5"
        className="font-text font-extrabold"
        fontSize="9"
        textAnchor="middle"
        dominantBaseline="central"
        style={fill("ink")}
      >
        50
      </text>
      <Ball x={82} y={82} r={14} />
      <circle cx="77" cy="77" r="4" style={fill("table-sheen", 0.6)} />
    </>
  );
}

function Roulette() {
  const seg = 360 / 37;
  const cx = 120;
  const cy = 80;
  const [bx, by] = polar(cx, cy, 53, 9 * seg - 90);
  return (
    <>
      <circle cx={cx + 3} cy={cy + 6} r="76" style={SHADE} />
      <circle cx={cx} cy={cy} r="76" style={paint("rail")} />
      <circle cx={cx} cy={cy} r="68" style={paint("groove")} />
      <circle cx={cx} cy={cy} r="68" style={stroke("paper", 0.16)} />
      <g className="table-tile-turn">
        {EUROPEAN_WHEEL_ORDER.map((n, k) => {
          const a0 = k * seg - 90 - seg / 2;
          const a1 = a0 + seg;
          const [x0, y0] = polar(cx, cy, 46, a0);
          const [x1, y1] = polar(cx, cy, 60, a0);
          const [x2, y2] = polar(cx, cy, 60, a1);
          const [x3, y3] = polar(cx, cy, 46, a1);
          const pocket = n === 0 ? "green" : RED_NUMBER_SET.has(n) ? "red" : "black";
          return (
            <path
              key={n}
              d={`M${x0} ${y0}L${x1} ${y1}A60 60 0 0 1 ${x2} ${y2}L${x3} ${y3}A46 46 0 0 0 ${x0} ${y0}Z`}
              strokeWidth="0.6"
              style={{ fill: tk(`pocket-${pocket}`), stroke: tk("paper", 0.35) }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r="46" style={paint("dish")} />
        {Array.from({ length: 8 }, (_, i) => {
          const [x, y] = polar(cx, cy, 44, i * 45);
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} style={{ stroke: tk("paper", 0.12) }} />
          );
        })}
        <rect x={cx - 2} y={cy - 16} width="4" height="32" rx="2" style={paint("chrome")} />
        <rect x={cx - 16} y={cy - 2} width="32" height="4" rx="2" style={paint("chrome")} />
        <circle cx={cx} cy={cy} r="7" style={paint("chrome")} />
        <circle cx={bx + 1} cy={by + 2} r="4.5" style={SHADE} />
        <circle cx={bx} cy={by} r="4.5" style={paint("ivory")} />
      </g>
    </>
  );
}

const HEART =
  "M50 90C20 66 6 50 6 33 6 19 17 9 30 9c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 24 0 17-14 33-44 57z";
const SPADE =
  "M50 6C62 25 92 40 92 61c0 13-10 21-21 21-8 0-14-4-17-9 1 10 5 17 12 22H34c7-5 11-12 12-22-3 5-9 9-17 9C18 82 8 74 8 61 8 40 38 25 50 6z";

function Baccarat() {
  const card = <rect x="3" y="5" width="54" height="78" rx="6" style={SHADE} />;
  const rank = (letter: string, token: string) => (
    <text x="6" y="16" className="font-text font-extrabold" fontSize="13" style={fill(token)}>
      {letter}
    </text>
  );
  return (
    <>
      <g transform="translate(150 34) rotate(14)">
        {card}
        <rect width="54" height="78" rx="6" style={paint("lattice")} />
        <rect
          x="2.5"
          y="2.5"
          width="49"
          height="73"
          rx="4.5"
          strokeWidth="3"
          style={stroke("paper")}
        />
      </g>
      <g transform="translate(40 46) rotate(-12)">
        {card}
        <rect width="54" height="78" rx="6" style={paint("ivory")} />
        {rank("A", "pocket-red")}
        <path d={HEART} transform="translate(6 19) scale(0.1)" style={fill("pocket-red")} />
        <path d={HEART} transform="translate(13 26) scale(0.28)" style={fill("pocket-red")} />
      </g>
      <g transform="translate(92 32) rotate(3)">
        {card}
        <rect width="54" height="78" rx="6" style={paint("ivory")} />
        {rank("K", "carbon")}
        <path d={SPADE} transform="translate(6 19) scale(0.1)" style={fill("carbon")} />
        <rect
          x="14"
          y="22"
          width="30"
          height="40"
          rx="3"
          strokeWidth="1.4"
          style={stroke("carbon")}
        />
        <text
          x="29"
          y="48"
          className="font-text font-extrabold"
          fontSize="20"
          textAnchor="middle"
          style={fill("carbon")}
        >
          K
        </text>
      </g>
    </>
  );
}

const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, 0]],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1]
  ]
};

function Die({ x, y, rot, n }: { x: number; y: number; rot: number; n: 1 | 4 | 5 }) {
  const s = 30;
  const g = s * 0.27;
  const pip = n === 1 ? s * 0.13 : s * 0.085;
  const pipFill = fill(n === 1 || n === 4 ? "pocket-red" : "carbon");
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-s / 2 + 3} y={-s / 2 + 5} width={s} height={s} rx={s * 0.2} style={SHADE} />
      <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.2} style={paint("ivory")} />
      {PIPS[n]!.map(([a, b], i) => (
        <circle key={i} cx={r2(a * g)} cy={r2(b * g)} r={r2(pip)} style={pipFill} />
      ))}
    </g>
  );
}

function SicBo() {
  return (
    <>
      <circle cx="124" cy="88" r="70" style={SHADE} />
      <circle cx="120" cy="80" r="70" style={paint("rail")} />
      <circle cx="120" cy="80" r="63" style={paint("dish")} />
      <circle
        cx="120"
        cy="80"
        r="50"
        strokeWidth="1"
        strokeDasharray="3 4"
        style={{ fill: "none", stroke: PAPER_FAINT }}
      />
      <Die x={100} y={64} rot={14} n={4} />
      <Die x={140} y={70} rot={-20} n={5} />
      <Die x={116} y={102} rot={32} n={1} />
      <g className="table-tile-lift">
        <circle cx="120" cy="80" r="70" style={paint("glass")} />
        <circle cx="120" cy="80" r="70" strokeWidth="1.2" style={stroke("table-sheen", 0.3)} />
        <ellipse
          cx="94"
          cy="48"
          rx="24"
          ry="11"
          transform="rotate(-28 94 48)"
          style={fill("table-sheen", 0.28)}
        />
        <circle
          cx="120"
          cy="80"
          r="11"
          style={{ fill: tk("table-sheen", 0.12), stroke: tk("table-sheen", 0.3) }}
        />
      </g>
    </>
  );
}

function Slots() {
  const bar = (x: number, y: number) => (
    <text
      x={x}
      y={y}
      className="font-text font-extrabold"
      fontSize="10"
      textAnchor="middle"
      style={{ fill: tk("carbon"), opacity: 0.35 }}
    >
      BAR
    </text>
  );
  return (
    <>
      <rect x="32" y="22" width="180" height="124" rx="14" style={SHADE} />
      <rect x="30" y="18" width="180" height="124" rx="14" style={paint("chrome")} />
      <rect x="38" y="26" width="164" height="108" rx="9" style={fill("pocket-black")} />
      {[0, 1, 2].map((i) => {
        const x = 46 + i * 52;
        return (
          <g key={i}>
            <rect x={x} y="30" width="46" height="100" rx="6" style={paint("reel")} />
            {bar(x + 23, 44)}
            <text
              x={x + 23}
              y="97"
              className="font-text font-extrabold"
              fontSize="46"
              textAnchor="middle"
              style={fill("pocket-red")}
            >
              7
            </text>
            {bar(x + 23, 126)}
          </g>
        );
      })}
      <path d="M34 74l7 6-7 6z" style={fill("paper")} />
      <path d="M206 74l-7 6 7 6z" style={fill("paper")} />
    </>
  );
}

function Plinko() {
  const pins: React.ReactNode[] = [];
  for (let row = 0; row < 7; row++) {
    const n = row + 3;
    for (let j = 0; j < n; j++) {
      pins.push(
        <circle
          key={`${row}-${j}`}
          cx={r2(120 + (j - (n - 1) / 2) * 17)}
          cy={24 + row * 15}
          r="2.8"
          style={paint("ivory")}
        />
      );
    }
  }
  return (
    <>
      <rect x="28" y="8" width="184" height="144" rx="16" style={paint("groove")} />
      <rect x="28" y="8" width="184" height="144" rx="16" style={stroke("paper", 0.12)} />
      {pins}
      {Array.from({ length: 10 }, (_, k) => (
        <rect
          key={k}
          x={r2(120 + (k - 4.5) * 17 - 7)}
          y="132"
          width="14"
          height="12"
          rx="2"
          style={fill("table-shade", 0.28)}
        />
      ))}
      <path
        d="M120 12 L120 24 L128.5 39 L120 54 L128.5 69"
        strokeWidth="1.2"
        strokeDasharray="2 3"
        style={{ ...stroke("paper"), opacity: 0.6 }}
      />
      <Ball x={128.5} y={76} r={6} red />
      <circle cx="126.5" cy="74" r="1.8" style={fill("table-sheen", 0.55)} />
    </>
  );
}

function Keno() {
  return (
    <>
      <rect x="74" y="134" width="56" height="10" rx="4" style={paint("chrome")} />
      <circle cx="106" cy="82" r="56" style={SHADE} />
      <circle cx="102" cy="76" r="56" style={fill("table-shade", 0.25)} />
      <Ball x={84} y={104} r={10} n={3} />
      <Ball x={104} y={108} r={10} n={8} />
      <Ball x={124} y={102} r={10} n={11} red />
      <Ball x={74} y={86} r={10} n={1} />
      <Ball x={94} y={88} r={10} n={6} red />
      <Ball x={114} y={86} r={10} n={14} />
      <Ball x={134} y={84} r={10} n={9} />
      <Ball x={104} y={68} r={10} n={12} />
      <circle cx="102" cy="76" r="56" style={paint("glass")} />
      <circle cx="102" cy="76" r="56" strokeWidth="1.2" style={stroke("table-sheen", 0.3)} />
      <ellipse
        cx="80"
        cy="44"
        rx="20"
        ry="9"
        transform="rotate(-30 80 44)"
        style={fill("table-sheen", 0.26)}
      />
      <path
        d="M140 34 Q174 18 186 44"
        strokeWidth="14"
        strokeLinecap="round"
        style={stroke("table-sheen", 0.25)}
      />
      <rect
        x="179"
        y="42"
        width="22"
        height="104"
        rx="11"
        style={{ fill: tk("table-sheen", 0.06), stroke: tk("table-sheen", 0.3) }}
      />
      <Ball x={190} y={134} r={9} n={4} red />
      <Ball x={190} y={114} r={9} n={7} red />
      <Ball x={190} y={94} r={9} n={2} />
    </>
  );
}

const PIECES: Record<CasinoModuleSlug, () => React.ReactElement> = {
  "coin-toss": Coin,
  dice: Dice,
  roulette: Roulette,
  baccarat: Baccarat,
  "sic-bo": SicBo,
  slots: Slots,
  plinko: Plinko,
  keno: Keno
};

/** A game's piece on its lobby table. Decorative: the tile's link names the game. */
export function TableVignette({ slug }: { slug: CasinoModuleSlug }) {
  const Piece = PIECES[slug];
  return (
    <svg
      viewBox="0 0 240 160"
      className="block aspect-[3/2] h-auto w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <Piece />
    </svg>
  );
}
