"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@ssot/ui";
import {
  MagnifyingGlassIcon,
  PlayCircleIcon,
  SparklesIcon,
  TrophyIcon
} from "@heroicons/react/24/outline";

import { Placeholder } from "../../components/Placeholder";
import { getCatalogRooms } from "../../features/games/catalog";
import {
  CoinTossMiniIcon,
  DiceMiniIcon,
  KenoMiniIcon,
  RouletteMiniIcon
} from "../../features/games/GameMiniIcons";
import { useRelease } from "../../ssot/release/ReleaseProvider";

const ROOM_ICON_MAP: Record<string, React.ReactNode> = {
  dice: <DiceMiniIcon />,
  roulette: <RouletteMiniIcon />,
  "coin-toss": <CoinTossMiniIcon />,
  keno: <KenoMiniIcon />
};

const ROOM_TAG_MAP: Record<string, string> = {
  dice: "Binary",
  roulette: "Table",
  "coin-toss": "Binary",
  keno: "Lottery"
};

const ROOM_COPY_MAP: Record<
  string,
  {
    title: string;
    promise: string;
    live: string;
    badge: string;
  }
> = {
  dice: {
    title: "Precision Dice",
    promise: "1-99 sizing in seconds.",
    live: "124",
    badge: "1% House Edge"
  },
  roulette: {
    title: "European Roulette",
    promise: "Classic 37-slot physical mechanics.",
    live: "312",
    badge: "Max Payout 36x"
  },
  "coin-toss": {
    title: "Coin Toss",
    promise: "High-speed 50/50 resolution.",
    live: "89",
    badge: "1% House Edge"
  },
  keno: {
    title: "Keno Draft",
    promise: "Pick multi-spots for massive multipliers.",
    live: "45",
    badge: "Huge 1,000x Win"
  }
};

const FILTERS = [
  { key: "all", label: "All Modules" },
  { key: "table", label: "Table Games" },
  { key: "binary", label: "Binary / Fast" },
  { key: "lottery", label: "Lottery" }
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function matchesFilter(slug: string, filter: FilterKey) {
  switch (filter) {
    case "table":
      return slug === "roulette";
    case "binary":
      return slug === "dice" || slug === "coin-toss";
    case "lottery":
      return slug === "keno";
    default:
      return true;
  }
}

export function GamesListClient() {
  const { release, readOnlyReason } = useRelease();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");

  if (!release) {
    return (
      <Placeholder
        title="Games"
        description={readOnlyReason ?? "No embedded release available for the connected chain."}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );
  }

  const rooms = getCatalogRooms(
    release.gamesMeta as Array<{ slug: string; label: string }> | undefined
  );

  if (!rooms.length) {
    return (
      <Placeholder
        title="Games"
        description="No games registered in the active release."
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );
  }

  const filteredRooms = rooms.filter((room) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      room.label.toLowerCase().includes(normalizedQuery) ||
      room.summary.toLowerCase().includes(normalizedQuery);
    return matchesQuery && matchesFilter(room.slug, filter);
  });

  const canonicalOrder = ["dice", "roulette", "coin-toss", "keno"];
  const roomsToRender = (filteredRooms.length ? filteredRooms : rooms).sort((a, b) => {
    const idxA = canonicalOrder.indexOf(a.slug);
    const idxB = canonicalOrder.indexOf(b.slug);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="relative overflow-hidden pb-16 text-fg selection:bg-brand/20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-soft to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[url('/textures/noise.svg')] opacity-10 mix-blend-overlay" />

      <section className="relative border-b border-border-soft py-12 md:py-16">
        <header className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand">
              <SparklesIcon className="h-4 w-4" />
              Global Casino Lobby
            </div>
            <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-fg md:text-6xl">
              Enter the Floor
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted md:text-xl">
              All modules are 100% on-chain, verifiable, and connected directly to the isolated
              reserve bank. Play directly from your wallet.
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 lg:min-w-[25rem]">
            <div className="rounded-xl border border-border bg-surface-1 p-5 shadow-e1">
              <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-glow" />
                Live Players
              </dt>
              <dd className="mt-3 font-mono text-3xl font-black text-fg">1,842</dd>
            </div>
            <div className="rounded-xl border border-border bg-surface-1 p-5 shadow-e1">
              <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand">
                <TrophyIcon className="h-3.5 w-3.5" />
                Max Win (24H)
              </dt>
              <dd className="mt-3 font-mono text-3xl font-black text-fg">$35,000</dd>
            </div>
          </dl>
        </header>
      </section>

      <section className="relative py-8 md:py-10">
        <div className="mb-10 flex flex-col gap-5 border-b border-border-soft pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full items-center gap-1 overflow-x-auto md:w-auto">
            {FILTERS.map((item) => {
              const isActive = item.key === filter;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    "relative flex-shrink-0 rounded-full px-5 py-3 text-sm font-bold transition-colors",
                    isActive
                      ? "bg-surface-3 text-fg"
                      : "text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  {item.label}
                  {isActive ? (
                    <span className="absolute -bottom-[1.55rem] left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand shadow-glow" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-80">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games..."
              aria-label="Search games"
              className="relative z-0 w-full rounded-full border border-border bg-surface-1 py-3 pl-12 pr-4 text-sm text-fg shadow-inner-e1 transition-colors placeholder:text-fg-subtle hover:border-brand/30 focus:border-brand focus:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-brand-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {roomsToRender.map((room) => {
            const copy = ROOM_COPY_MAP[room.slug] ?? {
              title: room.label,
              promise: room.summary,
              live: "--",
              badge: room.badge
            };

            return (
              <Link
                key={room.slug}
                href={room.href}
                data-testid="room-entry-card"
                data-slug={room.slug}
                className="group relative flex min-h-[24rem] flex-col overflow-hidden rounded-xl border border-border bg-surface-1 shadow-e1 transition duration-300 hover:-translate-y-1 hover:border-brand/50 hover:bg-surface-2 hover:shadow-glow"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-soft to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="absolute left-4 top-4 z-20 rounded-full border border-border bg-surface-0/80 px-3 py-1.5 backdrop-blur">
                  <span className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-fg-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {copy.live} playing
                  </span>
                </div>

                <div className="absolute right-4 top-4 z-20 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-[10px] font-bold uppercase text-brand backdrop-blur">
                  {copy.badge}
                </div>

                <div className="relative z-10 mt-10 flex flex-1 items-center justify-center p-6">
                  {ROOM_ICON_MAP[room.slug] ?? (
                    <div className="text-3xl font-bold text-fg-subtle">[{room.slug}]</div>
                  )}
                </div>

                <div className="relative z-20 border-t border-border-soft bg-surface-2/90 p-6 backdrop-blur">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-accent">
                    {ROOM_TAG_MAP[room.slug] ?? "Module"}
                  </div>
                  <h3 className="text-2xl font-bold text-fg">{copy.title}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-relaxed text-fg-muted">
                    {copy.promise}
                  </p>

                  <span className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-1 py-4 text-sm font-black text-fg-muted transition-colors group-hover:border-brand/40 group-hover:text-brand">
                    Play Now <PlayCircleIcon className="h-5 w-5 flex-shrink-0" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <aside className="mt-10 overflow-hidden rounded-xl border border-border bg-surface-1 p-1 shadow-e2">
          <div className="relative overflow-hidden rounded-lg border border-border-soft bg-surface-2 px-6 py-8 md:px-8 md:py-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand-soft to-transparent" />
            <div className="relative z-10 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand-soft text-brand shadow-glow">
                  <TrophyIcon className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-black tracking-tight text-fg">
                    Progressive Reserve Pool
                  </h3>
                  <p className="mt-2 font-mono text-sm font-medium uppercase tracking-widest text-fg-subtle">
                    Transparent / Verifiable / Unlocked
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end">
                <div className="font-mono text-5xl font-black tracking-tight text-fg md:text-6xl">
                  $1,452,093<span className="text-3xl text-fg-subtle">.42</span>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                    Yielding Real Time
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
