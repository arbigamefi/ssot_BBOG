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

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {rooms.slice(0, 8).map((room) => (
            <Link
              key={room.slug}
              href={room.href}
              className="group relative flex min-h-[270px] flex-col justify-between overflow-hidden rounded-xl border border-border-soft bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] p-5 shadow-e2 transition-[transform,box-shadow,border-color] duration-200 hover:border-brand/40 hover:shadow-e2"
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
              <div>
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div className="relative">
                    {/* brand bloom behind the room mark */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 transition-opacity duration-200 group-hover:opacity-100"
                      style={{
                        background:
                          "radial-gradient(circle, hsl(var(--brand) / 0.16), transparent 70%)"
                      }}
                    />
                    <div className="relative">
                      <CasinoGameMark slug={room.slug} className="h-24 w-24" />
                    </div>
                  </div>
                  <span className="rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                    {room.badge}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-fg">{room.label}</h3>
                <p className="mt-3 min-h-16 text-sm leading-6 text-fg-muted">{room.summary}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {room.facts.slice(0, 2).map((fact) => (
                  <span
                    key={fact}
                    className="rounded-md border border-border-soft bg-surface-2/70 px-2.5 py-1 text-[11px] font-bold text-fg-muted"
                  >
                    {fact}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
