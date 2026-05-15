import * as React from "react";

import { cn } from "@ssot/ui";

type Accent = "brand" | "accent" | "cyan" | "emerald";

const ACCENT_STYLES: Record<Accent, { shell: string; glow: string }> = {
  brand: { shell: "border-brand/30 bg-brand-soft text-brand", glow: "text-brand" },
  accent: { shell: "border-accent/30 bg-accent-soft text-accent", glow: "text-accent" },
  cyan: { shell: "border-brand/30 bg-brand-soft text-brand", glow: "text-brand" },
  emerald: { shell: "border-brand/30 bg-brand-soft text-brand", glow: "text-brand" }
};

export function ArbiGameFiMark({
  accent = "cyan",
  className
}: {
  accent?: Accent;
  className?: string;
}) {
  const style = ACCENT_STYLES[accent];
  const shellClassName = cn(
    "flex items-center justify-center rounded-lg border shadow-e1",
    style.shell,
    className
  );

  return (
    <div className={shellClassName}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("h-[72%] w-[72%]", style.glow)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`ag-mark-${accent}`}
            x1="10"
            y1="10"
            x2="38"
            y2="38"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="hsl(var(--brand))" />
            <stop offset="1" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        <path
          d="M16.5 34L24 13.5L31.5 34M19.6 25H28.4"
          stroke={`url(#ag-mark-${accent})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M34.5 18.5C32.6 15.8 29.6 14 26.2 14C20.3 14 15.5 18.8 15.5 24.7C15.5 30.6 20.3 35.4 26.2 35.4C30.7 35.4 34.6 32.6 36.1 28.6H29.3"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function ArbiGameFiBrand({
  accent = "cyan",
  subtitle,
  compact = false
}: {
  accent?: Accent;
  subtitle?: string;
  compact?: boolean;
}) {
  const wordmarkClassName = "text-sm font-black tracking-[0.08em] text-fg";
  const subtitleClassName = cn(
    "text-[11px] font-semibold uppercase tracking-[0.2em]",
    "text-fg-subtle",
    compact && "hidden"
  );

  return (
    <div className="flex items-center gap-3">
      <ArbiGameFiMark accent={accent} className={compact ? "h-9 w-9 rounded-xl" : "h-10 w-10"} />
      <div className="space-y-0.5">
        <div className={wordmarkClassName}>ArbiGameFi</div>
        {subtitle ? <div className={subtitleClassName}>{subtitle}</div> : null}
      </div>
    </div>
  );
}

export function ArbiGameFiLockup({
  className,
  alt = "ArbiGameFi"
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/brand/arbigamefi-lockup.svg"
      alt={alt}
      className={["block h-auto w-auto", className].filter(Boolean).join(" ")}
    />
  );
}
