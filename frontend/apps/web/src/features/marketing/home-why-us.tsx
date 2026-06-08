import * as React from "react";
import {
  CheckBadgeIcon,
  CodeBracketSquareIcon,
  ShieldCheckIcon,
  BoltIcon
} from "@heroicons/react/24/outline";

type WhyUsCopy = {
  eyebrow: string;
  title: string;
  items: ReadonlyArray<{ title: string; detail: string }>;
};

const ICONS = [ShieldCheckIcon, BoltIcon, CheckBadgeIcon, CodeBracketSquareIcon] as const;

export function HomeWhyUs({ copy }: { copy: WhyUsCopy }) {
  return (
    <section className="relative border-b border-border-soft bg-surface-1 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 lg:block"
        style={{
          background: "radial-gradient(circle at 20% 35%, hsl(var(--brand) / 0.1), transparent 62%)"
        }}
      />
      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
              {copy.eyebrow}
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-fg md:text-5xl">{copy.title}</h2>
          </div>

          <div className="divide-y divide-border-soft border-y border-border-soft">
            {copy.items.map((item, index) => {
              const Icon = ICONS[index] ?? ShieldCheckIcon;
              return (
                <div key={item.title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 py-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-brand/25 bg-brand-soft text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="text-lg font-bold text-fg">{item.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
