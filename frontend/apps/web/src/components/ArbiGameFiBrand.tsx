import * as React from "react";

import { cn } from "@ssot/ui";

type Accent = "brand" | "accent" | "cyan" | "emerald";

export function ArbiGameFiMark({ className }: { accent?: Accent; className?: string }) {
  return (
    <img
      src="/brand/logo-icon.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("block h-10 w-10 shrink-0 object-contain", className)}
    />
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
  const wordmarkClassName = "text-sm font-extrabold tracking-[-0.02em] text-fg";
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
      src="/brand/logo-full.svg"
      alt={alt}
      className={["block h-auto w-auto", className].filter(Boolean).join(" ")}
    />
  );
}
