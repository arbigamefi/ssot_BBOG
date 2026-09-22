import * as React from "react";
import { SectionEyebrow } from "./section-eyebrow";

type HowItWorksCopy = {
  eyebrow: string;
  title: string;
  items: ReadonlyArray<{ title: string; detail: string }>;
};

export function HomeHowItWorks({ copy }: { copy: HowItWorksCopy }) {
  return (
    <section className="relative border-b border-border-soft bg-surface-1 py-24 md:py-28">
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
          <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-fg sm:text-5xl md:text-5xl">
            {copy.title}
          </h2>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
          {copy.items.map((item, index) => {
            return (
              <li
                key={item.title}
                className="flex h-full flex-col rounded-xl border border-border-soft bg-surface-2 p-6 shadow-e1 transition-colors hover:border-brand/40"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold tracking-[0.18em] text-fg-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-lg font-bold leading-snug text-fg">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-fg-muted">{item.detail}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
