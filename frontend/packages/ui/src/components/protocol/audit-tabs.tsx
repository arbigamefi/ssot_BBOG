"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";

interface AuditTabsProps {
  /** The theme glow color active border class (e.g. "border-purple-400 text-purple-400") */
  activeColorClass?: string;
  className?: string;
  children?: React.ReactNode;
  tabs?: readonly string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const DEFAULT_TABS = ["All Bets", "My Bets", "Players", "Analytics", "Game Details"] as const;

export function AuditTabs({
  activeColorClass = "border-blue-400 text-blue-400",
  className,
  children,
  tabs = DEFAULT_TABS,
  activeTab: controlledActiveTab,
  onTabChange: controlledOnTabChange
}: AuditTabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]);

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = controlledOnTabChange || setInternalActiveTab;

  return (
    <div
      className={cn(
        "mt-8 border border-white/10 rounded-2xl md:rounded-3xl bg-[#0a0a0a] overflow-hidden flex flex-col",
        className
      )}
    >
      {/* Header Scrollable Tabs */}
      <div className="flex items-center gap-6 px-4 md:px-8 border-b border-white/5 bg-[#080808] overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "py-4 md:py-5 text-xs md:text-sm font-bold transition-all whitespace-nowrap border-b-2",
              activeTab === tab
                ? activeColorClass
                : "border-transparent text-white/40 hover:text-white"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scrollable Body Content */}
      <div className="p-4 md:p-6 overflow-x-auto">
        <div className="min-w-[600px] w-full">{children}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Compose Helpers for the Generic Table inside

export function AuditTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full text-left grid text-sm border-b border-white/10 pb-3 mb-2">
      {children}
    </div>
  );
}

export function AuditTableRow({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full text-left grid text-sm py-3 border-t border-white/5 transition-colors hover:bg-white/[0.02]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AuditTableCell({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-white/50 font-medium flex items-center", className)}>{children}</div>
  );
}
