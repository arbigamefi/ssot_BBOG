"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";

interface AuditTabsProps {
  /** Tokenized active border/text classes, for example "border-brand text-brand". */
  activeColorClass?: string;
  className?: string;
  children?: React.ReactNode;
  tabs?: readonly string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const DEFAULT_TABS = ["All Bets", "My Bets", "Players", "Analytics", "Game Details"] as const;

export function AuditTabs({
  activeColorClass = "border-brand text-brand",
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
        "mt-8 flex flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-e2",
        className
      )}
    >
      <div className="scrollbar-hide flex items-center gap-6 overflow-x-auto border-b border-border-soft bg-surface-2 px-4 md:px-8">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "whitespace-nowrap border-b-2 py-4 text-xs font-bold transition-colors md:py-5 md:text-sm",
              activeTab === tab
                ? activeColorClass
                : "border-transparent text-fg-subtle hover:text-fg"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto p-4 md:p-6">
        <div className="w-full min-w-[600px]">{children}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Compose Helpers for the Generic Table inside

export function AuditTableHeader({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mb-2 grid w-full border-b border-border pb-3 text-left text-sm", className)}
    >
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
        "grid w-full border-t border-border-soft py-3 text-left text-sm transition-colors hover:bg-surface-2",
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
    <div className={cn("flex items-center font-medium text-fg-muted", className)}>{children}</div>
  );
}
