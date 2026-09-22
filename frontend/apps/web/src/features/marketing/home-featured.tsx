import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

import { CasinoGameMark } from "../casino/CasinoMiniIcons";
import { SectionEyebrow } from "./section-eyebrow";

export function HomeFeatured({
  slug,
  href,
  copy
}: {
  slug: string;
  href: string;
  copy: {
    eyebrow: string;
    title: string;
    detail: string;
    cta: string;
  };
}) {
  return (
    <section className="border-b border-border-soft bg-surface-1 py-20">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div
          className="relative overflow-hidden rounded-lg border border-border-soft shadow-e3"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.18), transparent)"
            }}
          />
          {/* large brand bloom behind the mark */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-[-6%] top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--brand) / 0.22), transparent 68%)"
            }}
          />
          <div className="relative grid grid-cols-1 items-center gap-10 px-8 py-12 md:grid-cols-[1.1fr_0.9fr] md:px-12 md:py-14">
            <div>
              <SectionEyebrow className="mb-5">{copy.eyebrow}</SectionEyebrow>
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-fg md:text-5xl">
                {copy.title}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-fg-muted md:text-lg">
                {copy.detail}
              </p>
              <Link
                href={href}
                className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand px-6 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-fg-inverse shadow-e2 transition-[transform,box-shadow,background-color] hover:bg-brand-hover"
              >
                {copy.cta} <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex items-center justify-center md:justify-end">
              <CasinoGameMark slug={slug} className="h-48 w-48 md:h-56 md:w-56" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
