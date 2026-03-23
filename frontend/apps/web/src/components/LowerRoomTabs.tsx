"use client";

import * as React from "react";

import { cn } from "@ssot/ui";

export type LowerRoomTab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export function LowerRoomTabs({
  tabs,
  defaultTabId,
  className
}: {
  tabs: LowerRoomTab[];
  defaultTabId?: string;
  className?: string;
}) {
  const initialTab = defaultTabId ?? tabs[0]?.id;
  const [activeTab, setActiveTab] = React.useState(initialTab);

  React.useEffect(() => {
    if (!tabs.length) return;
    if (tabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab(defaultTabId ?? tabs[0]?.id);
  }, [activeTab, defaultTabId, tabs]);

  const visibleTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!visibleTab) return null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(6,9,18,0.94),rgba(6,9,16,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_60px_rgba(0,0,0,0.28)]",
        className
      )}
    >
      <div className="flex items-center gap-5 overflow-x-auto border-b border-white/6 px-5 md:px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "border-b-2 py-4 text-sm font-semibold whitespace-nowrap transition-colors",
              tab.id === visibleTab.id
                ? "border-cyan-300 text-white"
                : "border-transparent text-white/36 hover:text-white/76"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-5 md:p-6 lg:p-7">{visibleTab.content}</div>
    </section>
  );
}
