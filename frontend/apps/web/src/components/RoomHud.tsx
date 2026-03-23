"use client";

import * as React from "react";

import { cn } from "@ssot/ui";

type RoomHudItem = {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
};

export function RoomHud({
  eyebrow = "Live room",
  title,
  description,
  items,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  items: RoomHudItem[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.92),rgba(8,11,20,0.82))] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className
      )}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-[52rem] space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/52">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
            {eyebrow}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-[-0.04em] text-white md:text-[2.6rem]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-[46rem] text-sm leading-7 text-white/46">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[34rem]">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/36">
                {item.label}
              </div>
              <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
              {item.helper ? (
                <div className="mt-1 text-xs leading-5 text-white/42">{item.helper}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
