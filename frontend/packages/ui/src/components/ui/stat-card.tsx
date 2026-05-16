import * as React from "react";
import { cn } from "../../lib/utils";

export type StatCardProps = {
  /** Emoji or small icon element */
  icon?: React.ReactNode;
  label: string;
  value: string;
  /** Optional sub-value or unit */
  subValue?: string;
  /** Optional trend indicator: "up" | "down" | "neutral" */
  trend?: "up" | "down" | "neutral";
  className?: string;
};

/**
 * Single metric display card with glassmorphic dark styling.
 * Used in stat ribbons across pages (Home KPI, Liquidity TVL, Claims XP, etc.)
 */
export function StatCard({ icon, label, value, subValue, trend, className }: StatCardProps) {
  const trendColor =
    trend === "up" ? "text-success" : trend === "down" ? "text-danger" : "text-fg-subtle";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-1 p-5 shadow-e1 transition-colors hover:border-brand/40",
        className
      )}
    >
      {icon ? <div className="mb-2 text-2xl text-fg-muted">{icon}</div> : null}
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums tracking-tight text-fg">{value}</span>
        {subValue ? (
          <span className={cn("text-sm font-medium", trendColor)}>{subValue}</span>
        ) : null}
      </div>
    </div>
  );
}
