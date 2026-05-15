import * as React from "react";

type GameMiniIconProps = {
  className?: string;
};

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

function IconFrame({ className, children }: React.PropsWithChildren<GameMiniIconProps>) {
  return (
    <div
      className={cx(
        "relative flex h-32 w-32 items-center justify-center rounded-xl border border-brand/20 bg-surface-1 text-brand shadow-e2",
        "transition-transform duration-300 group-hover:scale-105",
        className
      )}
    >
      <div className="absolute inset-3 rounded-lg border border-fg/5 bg-brand/5" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function DiceMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20">
        <rect
          x="20"
          y="20"
          width="56"
          height="56"
          rx="14"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="4"
        />
        {[32, 48, 64].map((x, index) => (
          <circle key={x} cx={x} cy={index === 1 ? 48 : 32} r="5" fill="currentColor" />
        ))}
        <circle cx="32" cy="64" r="5" fill="currentColor" />
        <circle cx="64" cy="64" r="5" fill="currentColor" />
      </svg>
    </IconFrame>
  );
}

export function RouletteMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20">
        <circle cx="48" cy="48" r="34" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="48" cy="48" r="18" fill="currentColor" fillOpacity="0.1" />
        {Array.from({ length: 8 }).map((_, index) => {
          const angle = (Math.PI * 2 * index) / 8;
          const x = 48 + Math.cos(angle) * 32;
          const y = 48 + Math.sin(angle) * 32;
          return (
            <line
              key={index}
              x1="48"
              y1="48"
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.45"
              strokeWidth="2"
            />
          );
        })}
        <circle cx="48" cy="48" r="7" fill="currentColor" />
        <circle cx="63" cy="25" r="5" fill="currentColor" className="text-accent" />
      </svg>
    </IconFrame>
  );
}

export function CoinTossMiniIcon({ className }: GameMiniIconProps) {
  return (
    <IconFrame className={className}>
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20">
        <circle
          cx="48"
          cy="48"
          r="30"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="4"
        />
        <circle cx="48" cy="48" r="18" fill="none" stroke="currentColor" strokeOpacity="0.45" />
        <path
          d="M48 33v30M38 42c0-5 4-9 10-9s10 4 10 9c0 6-5 8-10 8s-10 2-10 8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
      </svg>
    </IconFrame>
  );
}

export function KenoMiniIcon({ className }: GameMiniIconProps) {
  const hits = new Set([2, 5, 10, 13]);
  return (
    <IconFrame className={className}>
      <div className="grid h-20 w-20 grid-cols-4 gap-1">
        {Array.from({ length: 16 }).map((_, index) => {
          const hit = hits.has(index);
          return (
            <div
              key={index}
              className={cx(
                "flex items-center justify-center rounded-sm border text-[9px] font-bold",
                hit
                  ? "border-brand bg-brand text-fg-inverse"
                  : "border-border-soft bg-surface-2 text-fg-subtle"
              )}
            >
              {index + 1}
            </div>
          );
        })}
      </div>
    </IconFrame>
  );
}
