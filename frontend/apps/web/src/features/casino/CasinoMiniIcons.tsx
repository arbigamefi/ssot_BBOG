import * as React from "react";

type GameMiniIconProps = {
  className?: string;
};

type CasinoGameMarkProps = GameMiniIconProps & {
  slug: string;
};

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

function IconFrame({ className, children }: React.PropsWithChildren<GameMiniIconProps>) {
  return (
    <div
      className={cx(
        "relative flex aspect-square h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-border-soft bg-[radial-gradient(circle_at_50%_22%,hsl(var(--surface-2)),hsl(var(--surface-1))_66%,hsl(var(--surface-0)))] text-brand shadow-e2",
        className
      )}
    >
      <div className="absolute inset-2 rounded-xl border border-fg/5 bg-fg/[0.015]" />
      <div
        aria-hidden
        className="absolute inset-x-5 top-4 h-px bg-gradient-to-r from-transparent via-fg/20 to-transparent"
      />
      <div className="relative z-10 flex h-full w-full items-center justify-center">{children}</div>
    </div>
  );
}

function pip(x: number, y: number, key: string) {
  return <circle key={key} cx={x} cy={y} r="2.6" fill="hsl(var(--fg))" opacity="0.9" />;
}

function svgNumber(value: number) {
  return Number(value.toFixed(3));
}

export function DiceMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[82%] w-[82%]">
        <path d="M60 15 97 36 60 57 23 36Z" fill="currentColor" opacity="0.28" />
        <path d="M23 36 60 57v44L23 79Z" fill="currentColor" opacity="0.16" />
        <path d="M97 36 60 57v44l37-22Z" fill="currentColor" opacity="0.22" />
        <path
          d="M60 15 97 36v43l-37 22-37-22V36Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <path
          d="M60 57v44M23 36l37 21 37-21"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.45"
        />
        <g>{[pip(50, 34, "top-1"), pip(60, 39, "top-2"), pip(70, 34, "top-3")]}</g>
        <g transform="skewY(30)">{[pip(40, 47, "left-1"), pip(53, 55, "left-2")]}</g>
        <g transform="skewY(-30)">
          {[pip(73, 108, "right-1"), pip(86, 100, "right-2"), pip(86, 116, "right-3")]}
        </g>
      </svg>
    </IconFrame>
  );
}

export function RouletteMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[82%] w-[82%]">
        <circle cx="60" cy="60" r="43" fill="currentColor" opacity="0.12" />
        <circle cx="60" cy="60" r="43" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle
          cx="60"
          cy="60"
          r="27"
          fill="hsl(var(--surface-0))"
          stroke="currentColor"
          strokeOpacity="0.55"
        />
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (Math.PI * 2 * index) / 12 - Math.PI / 2;
          const x1 = svgNumber(60 + Math.cos(angle) * 27);
          const y1 = svgNumber(60 + Math.sin(angle) * 27);
          const x2 = svgNumber(60 + Math.cos(angle) * 43);
          const y2 = svgNumber(60 + Math.sin(angle) * 43);
          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeOpacity={index % 2 === 0 ? "0.65" : "0.28"}
              strokeWidth="2"
            />
          );
        })}
        <circle cx="60" cy="60" r="8" fill="currentColor" />
        <path
          d="M30 47c11-26 48-27 62-4"
          fill="none"
          stroke="hsl(var(--fg))"
          strokeLinecap="round"
          strokeOpacity="0.35"
          strokeWidth="3"
        />
        <circle cx="86" cy="38" r="5" fill="hsl(var(--fg))" />
      </svg>
    </IconFrame>
  );
}

export function CoinTossMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[82%] w-[82%]">
        <ellipse cx="60" cy="86" rx="28" ry="6" fill="hsl(var(--fg))" opacity="0.08" />
        <circle cx="60" cy="55" r="35" fill="currentColor" opacity="0.13" />
        <circle cx="60" cy="55" r="35" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="60" cy="55" r="24" fill="none" stroke="hsl(var(--fg))" strokeOpacity="0.28" />
        <path
          d="M60 31c10 7 15 15 15 24S70 72 60 79c-10-7-15-15-15-24s5-17 15-24Z"
          fill="currentColor"
          opacity="0.28"
        />
        <path
          d="M45 54h30M52 43v24M68 43v24"
          fill="none"
          stroke="hsl(var(--fg))"
          strokeLinecap="round"
          strokeWidth="3"
          opacity="0.85"
        />
      </svg>
    </IconFrame>
  );
}

export function KenoMiniIcon({ className }: GameMiniIconProps) {
  const hits = new Set([2, 5, 9, 12, 14]);
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        <rect x="20" y="17" width="80" height="22" rx="11" fill="currentColor" opacity="0.13" />
        {[28, 44, 60, 76, 92].map((x, index) => (
          <circle
            key={x}
            cx={x}
            cy={28}
            r="6"
            fill={index === 2 ? "currentColor" : "hsl(var(--surface-3))"}
            stroke="currentColor"
            strokeOpacity="0.7"
          />
        ))}
        <rect
          x="18"
          y="48"
          width="84"
          height="54"
          rx="12"
          fill="hsl(var(--surface-0))"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
        {Array.from({ length: 15 }).map((_, index) => {
          const col = index % 5;
          const row = Math.floor(index / 5);
          const hit = hits.has(index);
          return (
            <g key={index} transform={`translate(${29 + col * 15}, ${61 + row * 15})`}>
              <rect
                x="-5"
                y="-5"
                width="10"
                height="10"
                rx="3"
                fill={hit ? "currentColor" : "hsl(var(--surface-2))"}
                stroke={hit ? "currentColor" : "hsl(var(--border))"}
                strokeWidth="1.5"
              />
              {hit ? <circle cx="0" cy="0" r="1.5" fill="hsl(var(--fg-inverse))" /> : null}
            </g>
          );
        })}
      </svg>
    </IconFrame>
  );
}

export function PlinkoMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        <path
          d="M60 14 99 89H21Z"
          fill="currentColor"
          opacity="0.08"
          stroke="currentColor"
          strokeOpacity="0.5"
        />
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: row + 1 }).map((__, index) => {
            const x = 60 + (index - row / 2) * 12;
            const y = 25 + row * 10;
            return (
              <circle
                key={`${row}-${index}`}
                cx={x}
                cy={y}
                r="2.8"
                fill="hsl(var(--fg))"
                opacity="0.72"
              />
            );
          })
        )}
        <path
          d="M60 18c-9 17-3 26 8 34 10 7 14 15 2 29"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle cx="70" cy="80" r="7" fill="currentColor" />
        <g transform="translate(23 92)">
          {[1, 2, 8, 2, 1].map((value, index) => (
            <rect
              key={`${value}-${index}`}
              x={index * 15}
              y="0"
              width="12"
              height="10"
              rx="3"
              fill={value === 8 ? "currentColor" : "hsl(var(--surface-2))"}
              stroke="currentColor"
              strokeOpacity="0.65"
            />
          ))}
        </g>
      </svg>
    </IconFrame>
  );
}

export function BaccaratMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        <path
          d="M22 77c12 16 64 16 76 0"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.42"
          strokeWidth="3"
        />
        <g transform="translate(23 25) rotate(-8)">
          <rect
            width="30"
            height="42"
            rx="5"
            fill="hsl(var(--surface-0))"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <circle cx="15" cy="17" r="6" fill="currentColor" opacity="0.4" />
          <path
            d="M9 30h12"
            stroke="hsl(var(--fg))"
            strokeLinecap="round"
            strokeWidth="2"
            opacity="0.75"
          />
        </g>
        <g transform="translate(67 25) rotate(8)">
          <rect
            width="30"
            height="42"
            rx="5"
            fill="hsl(var(--surface-0))"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path d="M15 11 22 22H8Z" fill="currentColor" opacity="0.45" />
          <path
            d="M9 31h12"
            stroke="hsl(var(--fg))"
            strokeLinecap="round"
            strokeWidth="2"
            opacity="0.75"
          />
        </g>
        {[35, 60, 85].map((x, index) => (
          <g key={x}>
            <circle
              cx={x}
              cy="86"
              r={index === 1 ? "9" : "12"}
              fill={index === 1 ? "hsl(var(--surface-2))" : "currentColor"}
              opacity={index === 1 ? "1" : "0.18"}
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle
              cx={x}
              cy="86"
              r="3"
              fill={index === 1 ? "currentColor" : "hsl(var(--fg))"}
              opacity="0.8"
            />
          </g>
        ))}
      </svg>
    </IconFrame>
  );
}

export function SicBoMiniIcon({ className }: GameMiniIconProps) {
  const positions = [
    { x: 42, y: 44, v: 4 },
    { x: 61, y: 52, v: 2 },
    { x: 78, y: 42, v: 6 }
  ] as const;
  const pipMap: Record<(typeof positions)[number]["v"], Array<[number, number]>> = {
    2: [
      [-4, -4],
      [4, 4]
    ],
    4: [
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4]
    ],
    6: [
      [-4, -5],
      [4, -5],
      [-4, 0],
      [4, 0],
      [-4, 5],
      [4, 5]
    ]
  };
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        <path
          d="M25 31c11-12 59-12 70 0v34c-8 15-61 15-70 0Z"
          fill="currentColor"
          opacity="0.09"
          stroke="currentColor"
          strokeOpacity="0.45"
        />
        {positions.map((die) => (
          <g
            key={`${die.x}-${die.y}`}
            transform={`translate(${die.x} ${die.y}) rotate(${die.v * 4})`}
          >
            <rect
              x="-10"
              y="-10"
              width="20"
              height="20"
              rx="5"
              fill="hsl(var(--surface-0))"
              stroke="currentColor"
              strokeWidth="2"
            />
            {pipMap[die.v].map(([x, y], index) => (
              <circle key={index} cx={x} cy={y} r="2" fill="hsl(var(--fg))" opacity="0.9" />
            ))}
          </g>
        ))}
        <g transform="translate(24 81)">
          {["small", "triple", "total"].map((name, index) => (
            <rect
              key={name}
              x={index * 25}
              y="0"
              width="22"
              height="16"
              rx="5"
              fill={index === 0 ? "currentColor" : "hsl(var(--surface-2))"}
              opacity={index === 0 ? "0.28" : "1"}
              stroke="currentColor"
              strokeOpacity="0.55"
            />
          ))}
        </g>
      </svg>
    </IconFrame>
  );
}

export function SlotsMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[84%] w-[84%]">
        <rect
          x="20"
          y="25"
          width="80"
          height="66"
          rx="14"
          fill="hsl(var(--surface-0))"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path d="M20 48h80M20 69h80M47 25v66M73 25v66" stroke="currentColor" strokeOpacity="0.35" />
        <path
          d="M89 18h9v28"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <circle cx="98" cy="50" r="5" fill="currentColor" />
        <text x="35" y="62" textAnchor="middle" className="fill-fg font-mono text-[18px] font-bold">
          7
        </text>
        <path d="M58 54h10M63 49v10" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path
          d="M82 58c6-10 15-3 7 5-2 2-5 4-7 7-2-3-5-5-7-7-8-8 1-15 7-5Z"
          fill="currentColor"
          opacity="0.55"
        />
        <rect x="35" y="94" width="50" height="6" rx="3" fill="currentColor" opacity="0.35" />
      </svg>
    </IconFrame>
  );
}

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
      return (
        <IconFrame className={className}>
          <svg viewBox="0 0 120 120" aria-hidden="true" className="h-[82%] w-[82%]">
            <circle cx="60" cy="60" r="38" fill="currentColor" opacity="0.12" />
            <circle cx="60" cy="60" r="38" fill="none" stroke="currentColor" strokeWidth="3" />
            <path
              d="M38 60h44M60 38v44"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="4"
            />
          </svg>
        </IconFrame>
      );
  }
}
