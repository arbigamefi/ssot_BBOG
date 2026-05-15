import * as React from "react";
import Link from "next/link";
import { CircleStackIcon } from "@heroicons/react/24/outline";

import type { LandingRoom } from "./home-types";
import { SectionHeader } from "./section-header";
import {
  CoinTossMiniIcon,
  DiceMiniIcon,
  KenoMiniIcon,
  RouletteMiniIcon
} from "../casino/CasinoMiniIcons";

const ROOM_ICON_MAP: Record<string, React.ReactNode> = {
  dice: <DiceMiniIcon />,
  roulette: <RouletteMiniIcon />,
  "coin-toss": <CoinTossMiniIcon />,
  keno: <KenoMiniIcon />
};

export function HomeRoomDirectory({ rooms }: { rooms: readonly LandingRoom[] }) {
  return (
    <section className="border-b border-border bg-surface-0 py-20">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <SectionHeader
          eyebrow="Casino rooms"
          title="Four one-shot RNG games, one settlement rail."
          detail="Each room maps to a release-defined module. The UI can change, but game identity, parameters, and payout path stay anchored to the SSOT release."
          actionHref="/casino"
          actionLabel="Open directory"
        />

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {rooms.slice(0, 4).map((room) => (
            <Link
              key={room.slug}
              href={room.href}
              className="group flex min-h-[300px] flex-col justify-between rounded-md border border-border bg-surface-1 p-5 shadow-e1 transition hover:-translate-y-1 hover:border-brand-ring hover:bg-surface-2 hover:shadow-e2"
            >
              <div>
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div className="h-24 w-24 transition duration-300 group-hover:scale-105">
                    {ROOM_ICON_MAP[room.slug] ?? <CircleStackIcon className="h-full w-full" />}
                  </div>
                  <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
                    {room.badge}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-fg">{room.label}</h3>
                <p className="mt-3 min-h-16 text-sm leading-6 text-fg-muted">{room.summary}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {room.facts.slice(0, 2).map((fact) => (
                  <span
                    key={fact}
                    className="rounded-sm border border-border-soft bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-fg-muted"
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
