"use client";

import * as React from "react";
import {
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  PlayCircleIcon,
  SparklesIcon,
  TrophyIcon
} from "@heroicons/react/24/outline";

import { Placeholder } from "../../components/Placeholder";
import { RoomEntryCard } from "../../components/RoomEntryCard";
import { getCatalogRooms } from "../../features/games/catalog";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import {
  CoinTossMiniIcon,
  DiceMiniIcon,
  KenoMiniIcon,
  RouletteMiniIcon
} from "../prototype/components/PrototypeGameIcons";

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

const RAW_ROOM_COPY_MAP: Record<
  string,
  {
    title: string;
    promise: string;
    live: string;
  }
> = {
  dice: { title: "Precision Dice", promise: "1-99 sizing in seconds.", live: "—" },
  roulette: {
    title: "European Roulette",
    promise: "Classic 37-slot physical mechanics.",
    live: "—"
  },
  "coin-toss": { title: "Coin Toss", promise: "High-speed 50/50 resolution.", live: "—" },
  keno: { title: "Keno Draft", promise: "Pick multi-spots for massive multipliers.", live: "—" }
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

  const roomsToRender = filteredRooms.length ? filteredRooms : rooms;
  const primaryAssetSet = release.assets?.length
    ? release.assets.map((asset) => asset.symbol).join(" • ")
    : "Pending";

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-blue-500/30">
      <div className="fixed top-0 right-0 left-0 z-0 h-[500px] bg-gradient-to-b from-blue-900/10 via-[#050505]/50 to-[#050505] pointer-events-none" />

      <main className="relative z-10 mx-auto max-w-[1440px] px-6 py-12 md:py-16">
        <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-300">
              <SparklesIcon className="h-4 w-4" /> Global Access Lobby
            </div>
            <h1 className="mb-4 bg-gradient-to-r from-white to-white/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl">
              Select Game Module
            </h1>
            <p className="text-lg leading-relaxed text-white/50">
              All modules are on-chain, verifiable, and connected directly to the isolated reserve
              bank. Connect wallet to enter.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/20 bg-[#020202] p-4 px-6 shadow-[0_0_30px_rgba(16,185,129,0.1),inset_0_2px_15px_rgba(16,185,129,0.05)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:8px_8px] opacity-20" />
            <div className="relative z-10 flex gap-6">
              <div className="flex flex-col">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">
                  Live Players
                </span>
                <span className="flex items-center gap-2 font-mono text-xl text-emerald-400">
                  <span className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  —
                </span>
              </div>
              <div className="relative z-10 w-px bg-emerald-500/20" />
              <div className="flex flex-col">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                  Max Win (24h)
                </span>
                <span className="font-mono text-xl text-amber-400">—</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mb-10 flex flex-col items-center gap-4 sm:flex-row">
          <div className="group relative w-full sm:w-96">
            <MagnifyingGlassIcon className="absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2 text-blue-400/50 transition-colors group-focus-within:text-blue-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules..."
              className="relative z-0 w-full rounded-2xl border border-blue-500/30 bg-[#020202] py-4 pr-4 pl-12 text-sm text-blue-50 placeholder:text-blue-500/30 shadow-[inset_0_4px_15px_rgba(0,0,0,0.8)] transition-all focus:border-blue-400 focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3),inset_0_2px_15px_rgba(0,0,0,1)]"
            />
          </div>

          <div className="hide-scrollbar flex w-full flex-1 gap-2 overflow-x-auto rounded-[1.25rem] border border-white/5 bg-[#050505] p-1 shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={
                  item.key === filter
                    ? "flex-shrink-0 rounded-xl bg-blue-500 px-6 py-3.5 text-sm font-extrabold text-black shadow-[0_0_20px_rgba(59,130,246,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)]"
                    : "flex-shrink-0 rounded-xl border border-transparent bg-transparent px-6 py-3.5 text-sm font-bold text-white/40 transition-all hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
                }
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="ml-auto rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3.5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roomsToRender.map((room) => {
            const copy = RAW_ROOM_COPY_MAP[room.slug] ?? {
              title: room.label,
              promise: room.summary,
              live: "—"
            };
            return (
              <RoomEntryCard
                key={room.slug}
                slug={room.slug}
                href={room.href}
                title={copy.title}
                summary={copy.promise}
                badge={ROOM_TAG_MAP[room.slug] ?? "Module"}
                meta={copy.live}
                accent={room.accent}
                icon={ROOM_ICON_MAP[room.slug] ?? <div className="text-5xl">{room.icon}</div>}
                actionLabel="Enter Module"
              />
            );
          })}
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-[#0a0a0a] p-1">
          <div className="rounded-[2.4rem] bg-[#050505]/80 px-8 py-10 backdrop-blur-2xl md:py-12">
            <div className="relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row">
              <div className="flex items-center gap-6">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                  <TrophyIcon className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="mb-1 text-2xl font-bold">Global Prize Pool</h3>
                  <p className="text-sm text-white/40">
                    Canonical modules exposed on the active release asset grid.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/34">
                    Primary asset set
                  </div>
                  <div className="mt-2 font-mono text-sm text-white/70">{primaryAssetSet}</div>
                </div>
                <div className="bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-4xl font-extrabold text-transparent md:text-5xl">
                  —
                </div>
                <div className="hidden h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/60 md:flex">
                  <PlayCircleIcon className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
