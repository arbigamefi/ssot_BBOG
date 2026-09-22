import * as React from "react";
import {
  CheckBadgeIcon,
  CodeBracketSquareIcon,
  ShieldCheckIcon,
  BoltIcon
} from "@heroicons/react/24/outline";
import { SectionEyebrow } from "./section-eyebrow";

type WhyUsCopy = {
  eyebrow: string;
  title: string;
  items: ReadonlyArray<{ title: string; detail: string }>;
};

const ICONS = [ShieldCheckIcon, BoltIcon, CheckBadgeIcon, CodeBracketSquareIcon] as const;

export function HomeWhyUs({ copy }: { copy: WhyUsCopy }) {
  return (
    <section className="relative border-b border-border-soft bg-surface-1 py-24 md:py-28">
      {/* Every other section on this page is a left-title / right-content split
          at the same 48px heading size, so the page reads at one constant
          weight. This is the claim the whole product rests on -- a casino's
          first objection is "can you cheat me" -- and it deserves to be the
          place the eye stops. Centering it and stepping the heading above the
          rest of the page breaks that cadence on purpose. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 18%, hsl(var(--brand) / 0.12), transparent 58%)"
        }}
      />
      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <SectionEyebrow className="mb-5">{copy.eyebrow}</SectionEyebrow>
          <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-fg sm:text-5xl md:text-6xl lg:text-7xl">
            {copy.title}
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-5">
          {copy.items.map((item, index) => {
            const Icon = ICONS[index] ?? ShieldCheckIcon;
            return (
              <div
                key={item.title}
                className="flex h-full flex-col rounded-xl border border-border-soft bg-surface-2 p-6 shadow-e1 transition-colors hover:border-brand/40"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md border border-brand/25 bg-brand-soft text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs font-bold tracking-[0.18em] text-fg-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-lg font-bold leading-snug text-fg">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-fg-muted">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
