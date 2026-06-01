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
    <section className="relative border-b border-border-soft bg-surface-0 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.1), transparent 68%)" }}
      />
      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="mb-12 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
            {copy.eyebrow}
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-fg md:text-5xl">{copy.title}</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {copy.items.map((item, index) => {
            const Icon = ICONS[index] ?? ShieldCheckIcon;
            return (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-xl border border-border-soft p-6 shadow-e2 transition-[transform,box-shadow] hover:shadow-e2"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
                  }}
                />
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-brand/30 bg-brand-soft text-brand">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-fg">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-fg-muted">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
