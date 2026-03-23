"use client";

import * as React from "react";

import { cn } from "@ssot/ui";

export function TrustTableShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  className
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,15,26,0.92),rgba(5,8,14,0.96))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_60px_rgba(0,0,0,0.35)] md:p-8",
        className
      )}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-3 text-sm leading-7 text-white/48">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
