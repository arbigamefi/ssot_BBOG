"use client";

import * as React from "react";

import { cn } from "@ssot/ui";

type HeroProofItem = {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
};

export function HeroProofRibbon({
  items,
  className
}: {
  items: HeroProofItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        "grid gap-3 rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:grid-cols-3",
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3"
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
            {item.label}
          </div>
          <div className="mt-2 text-base font-semibold text-white">{item.value}</div>
          {item.helper ? (
            <div className="mt-1 text-xs leading-5 text-white/42">{item.helper}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
