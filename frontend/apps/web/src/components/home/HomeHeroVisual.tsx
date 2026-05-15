"use client";

import * as React from "react";
import Link from "next/link";
import { ArbiGameFiBrand, ArbiGameFiMark } from "../ArbiGameFiBrand";

type HeroRoom = {
  label: string;
  active?: boolean;
};

export function HomeHeroVisual({
  icon,
  featuredLabel,
  featuredDescriptor,
  roomSummary,
  syncLabel,
  roomCount,
  indexedBetCount,
  stageClassName,
  rooms
}: {
  icon: string;
  featuredLabel: string;
  featuredDescriptor: string;
  roomSummary: string;
  syncLabel: string;
  roomCount: number;
  indexedBetCount: number;
  stageClassName: string;
  rooms: HeroRoom[];
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2.25rem] border border-white/10 shadow-2xl shadow-slate-950/40 ${stageClassName}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_24%)]" />
      <div className="absolute left-6 top-6 h-32 w-32 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute bottom-8 right-8 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ArbiGameFiBrand accent="cyan" subtitle="Premium on-chain rooms" />
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/45 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,249,0.55)]" />
            {syncLabel}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {rooms.map((room) => (
            <div
              key={room.label}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                room.active
                  ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100"
                  : "border-white/10 bg-slate-950/35 text-slate-300"
              }`}
            >
              {room.label}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/40 p-5 shadow-lg shadow-black/25">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Featured room
                </div>
                <div className="text-2xl font-black tracking-tight text-white">{featuredLabel}</div>
                <div className="text-sm font-medium text-cyan-100">{featuredDescriptor}</div>
              </div>

              <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/10 bg-slate-950/50 shadow-xl shadow-black/40">
                <div className="absolute inset-2 rounded-[1.35rem] border border-white/10 bg-white/[0.03]" />
                <div className="relative text-4xl">{icon}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-4">
                <div className="absolute left-6 top-5 h-24 w-24 rounded-full bg-cyan-300/10 blur-2xl" />
                <div className="flex items-center gap-3">
                  <ArbiGameFiMark accent="cyan" className="h-12 w-12 rounded-[1.2rem]" />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Room energy
                    </div>
                    <div className="text-sm font-semibold text-white">
                      Table first, trust nearby
                    </div>
                  </div>
                </div>
                <p className="relative mt-4 max-w-md text-sm leading-6 text-slate-300">
                  {roomSummary}
                </p>

                <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Room count
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">{roomCount}</div>
                  </div>
                  <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Ticket feed
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">{indexedBetCount}</div>
                  </div>
                  <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Settlement
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">Visible path</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-black/25">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Ticket preview
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">Quick room entry</div>
                  </div>
                  <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    Live
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-400">Room</span>
                    <span className="font-semibold text-white">{featuredLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-400">Stake lane</span>
                    <span className="font-semibold text-white">0.10 / 0.50 / 1.00</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-400">Settle path</span>
                    <span className="font-semibold text-white">Quote before sign</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {["0.10", "0.50", "1.00", "5.00"].map((chip) => (
                    <div
                      key={chip}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200"
                    >
                      {chip}
                    </div>
                  ))}
                </div>

                <Link
                  href="/casino"
                  className="mt-5 flex items-center justify-between rounded-[1.25rem] border border-cyan-300/30 bg-cyan-300/12 px-4 py-3 text-sm font-semibold text-cyan-50 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/16"
                >
                  <span>Open live rooms</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Brand line
              </div>
              <div className="mt-3 text-sm font-semibold text-white">
                Premium on-chain rooms, clearer settlement.
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Built to feel playable first, while keeping the trust layer visible when users need
                the full record.
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Visual direction
              </div>
              <div className="mt-3 grid gap-3">
                <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <div className="text-sm font-semibold text-white">Dark lacquer surfaces</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Deep navy, cyan rail, controlled magenta accent.
                  </div>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <div className="text-sm font-semibold text-white">Room-led hierarchy</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Brand supports the room, instead of pushing protocol chrome into the hero.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
