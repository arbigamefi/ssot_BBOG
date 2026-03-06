import * as React from "react";
import { cn } from "../../lib/utils";

export type BetStatus = "placed" | "pending" | "settled" | "won" | "lost" | "cancelled" | "failed";

const STATUS_STYLES: Record<BetStatus, string> = {
    placed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    settled: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    won: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    lost: "bg-slate-600/15 text-slate-500 border-slate-600/30",
    cancelled: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_DOTS: Record<BetStatus, string> = {
    placed: "bg-blue-400",
    pending: "bg-amber-400 animate-pulse",
    settled: "bg-slate-400",
    won: "bg-emerald-400",
    lost: "bg-slate-500",
    cancelled: "bg-rose-400",
    failed: "bg-red-400",
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
        >
            <span className={cn("rounded-full", STATUS_DOTS[status] ?? STATUS_DOTS.settled, size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")} />
            {displayLabel}
        </span>
    );
}
