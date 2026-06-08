import * as React from "react";
import Link from "next/link";

import type { LandingRoom } from "./home-types";
import { SectionHeader } from "./section-header";
import { CasinoGameMark } from "../casino/CasinoMiniIcons";

export function HomeRoomDirectory({
  rooms,
  copy
}: {
  rooms: readonly LandingRoom[];
  copy: {
    eyebrow: string;
    title: string;
    detail: string;
    actionLabel: string;
  };
}) {
  return (
    <section className="border-b border-border-soft bg-surface-0 py-20">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <SectionHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          detail={copy.detail}
          actionHref="/casino"
          actionLabel={copy.actionLabel}
        />

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-4">
          {rooms.map((room) => (
            <Link
              key={room.slug}
              href={room.href}
              className="group relative grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-xl border border-border-soft bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] p-4 shadow-e1 transition-[transform,box-shadow,border-color] duration-200 hover:border-brand/40 md:grid-cols-[6.25rem_minmax(0,1fr)] lg:flex lg:min-h-[270px] lg:flex-col lg:items-stretch lg:justify-between lg:gap-0 lg:p-5 lg:shadow-e2 lg:hover:-translate-y-0.5 lg:hover:shadow-e3"
            >
              {/* top edge sheen */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
                }}
              />
              <div className="relative min-h-20 lg:mb-8 lg:flex lg:items-start lg:justify-between lg:gap-4">
                <div className="relative">
                  {/* brand bloom behind the room mark */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-55 transition-opacity duration-200 group-hover:opacity-90 lg:h-32 lg:w-32 lg:opacity-60 lg:group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(circle, hsl(var(--brand) / 0.16), transparent 70%)"
                    }}
                  />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-lg border border-border-soft bg-surface-1/70 md:h-24 md:w-24 lg:block lg:h-auto lg:w-auto lg:border-0 lg:bg-transparent">
                    <CasinoGameMark
                      slug={room.slug}
                      className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24"
                    />
                  </div>
                </div>
                <span className="hidden rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand lg:inline-flex">
                  {room.badge}
                </span>
              </div>
              <div className="min-w-0">
                <div>
                  <span className="mb-1.5 inline-flex rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand lg:hidden">
                    {room.badge}
                  </span>
                  <h3 className="truncate text-xl font-bold text-fg lg:text-2xl">{room.label}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-fg-muted lg:mt-3 lg:min-h-16">
                    {room.summary}
                  </p>
                </div>
                <div className="mt-4 hidden flex-wrap gap-2 lg:flex">
                  {room.facts.slice(0, 2).map((fact) => (
                    <span
                      key={fact}
                      className="rounded-md border border-border-soft bg-surface-2/70 px-2.5 py-1 text-[11px] font-bold text-fg-muted"
                    >
                      {fact}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
