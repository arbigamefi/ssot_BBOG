import * as React from "react";
import { cn } from "../../lib/utils";

export type TabBarItem = {
    key: string;
    label: string;
    disabled?: boolean;
};

export type TabBarProps = {
    tabs: TabBarItem[];
    activeKey: string;
    onTabChange: (key: string) => void;
    className?: string;
};

/**
 * Pill-style tab bar for switching between views (Deposit/Withdraw/Redeem, etc.)
 * Dark glassmorphic styling consistent with the casino design system.
 */
export function TabBar({ tabs, activeKey, onTabChange, className }: TabBarProps) {
    return (
        <div className={cn("inline-flex items-center gap-1 rounded-xl bg-slate-800/50 border border-slate-700/50 p-1", className)}>
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    disabled={tab.disabled}
                    onClick={() => onTabChange(tab.key)}
                    className={cn(
                        "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                        activeKey === tab.key
                            ? "bg-slate-700 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30",
                        tab.disabled && "opacity-40 cursor-not-allowed"
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
