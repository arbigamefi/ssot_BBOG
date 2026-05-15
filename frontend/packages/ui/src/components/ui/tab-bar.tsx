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
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-surface-1 p-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          disabled={tab.disabled}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeKey === tab.key
              ? "bg-surface-3 text-fg shadow-e1"
              : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            tab.disabled && "cursor-not-allowed opacity-40"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
