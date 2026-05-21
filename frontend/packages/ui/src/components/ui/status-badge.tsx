import * as React from "react";
import { cn } from "../../lib/utils";

export type BetStatus = "placed" | "pending" | "settled" | "won" | "lost" | "cancelled" | "failed";

const STATUS_STYLES: Record<BetStatus, string> = {
  placed: "border-info/30 bg-info-soft text-info",
  pending: "border-warn/30 bg-warn-soft text-warn",
  settled: "border-border bg-surface-2 text-fg-muted",
  won: "border-success/30 bg-success-soft text-success",
  lost: "border-border-soft bg-surface-1 text-fg-subtle",
  cancelled: "border-danger/30 bg-danger-soft text-danger",
  failed: "border-danger/30 bg-danger-soft text-danger"
};

const STATUS_DOTS: Record<BetStatus, string> = {
  placed: "bg-info",
  pending: "bg-warn animate-pulse",
  settled: "bg-fg-muted",
  won: "bg-success",
  lost: "bg-fg-subtle",
  cancelled: "bg-danger",
  failed: "bg-danger"
};

export type StatusBadgeProps = {
  status: BetStatus;
  /** Override display label */
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

/**
 * On-chain status badge with colored dot indicator.
 * Used in bet lists, transaction traces, and detail pages.
 */
export function StatusBadge({ status, label, size = "sm", className }: StatusBadgeProps) {
  const displayLabel = label ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        STATUS_STYLES[status] ?? STATUS_STYLES.settled,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
      aria-label={`Status: ${displayLabel}`}
    >
      <span
        className={cn(
          "rounded-full",
          STATUS_DOTS[status] ?? STATUS_DOTS.settled,
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"
        )}
      />
      {displayLabel}
    </span>
  );
}
