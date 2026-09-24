import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { SectionEyebrow } from "./section-eyebrow";

export function HomeFooterCta({
  copy
}: {
  copy: {
    eyebrow: string;
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
}) {
  return (
    <section className="relative overflow-hidden bg-surface-0 py-24">
      {/* atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(80% 60% at 50% 50%, hsl(var(--surface-2)), transparent 70%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[960px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(var(--brand) / 0.18), transparent 65%)"
        }}
      />
      <div className="relative mx-auto max-w-[1100px] px-6 text-center lg:px-10">
        <SectionEyebrow className="mb-5">{copy.eyebrow}</SectionEyebrow>
        <h2 className="mx-auto max-w-3xl text-balance break-words text-3xl font-bold leading-[1.05] tracking-tight text-fg sm:text-5xl md:text-6xl">
          {copy.title}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-7 text-fg-muted">{copy.description}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/casino"
            className="inline-flex items-center justify-center gap-3 rounded-md bg-brand px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-fg-inverse shadow-e2 transition-[transform,box-shadow,background-color] hover:bg-brand-hover"
          >
            {copy.primary} <ArrowRightIcon className="h-5 w-5" />
          </Link>
          <Link
            href="/portfolio/activity"
            className="inline-flex items-center justify-center rounded-md border border-border-soft bg-surface-2 px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-fg transition-[transform,box-shadow,border-color,background-color] hover:border-brand/40 hover:bg-surface-3 hover:shadow-e2"
          >
            {copy.secondary}
          </Link>
        </div>
      </div>
    </section>
  );
}
