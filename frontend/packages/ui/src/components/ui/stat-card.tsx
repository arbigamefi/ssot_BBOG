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
    const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-slate-500";

    return (
        <div
            className={cn(
                "rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-5 transition-colors hover:border-slate-700",
                className
            )}
        >
            {icon ? <div className="text-2xl mb-2 opacity-80">{icon}</div> : null}
            <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">{label}</div>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white tabular-nums tracking-tight">{value}</span>
                {subValue ? <span className={cn("text-sm font-medium", trendColor)}>{subValue}</span> : null}
            </div>
        </div>
    );
}
