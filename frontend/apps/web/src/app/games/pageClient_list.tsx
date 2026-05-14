"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@ssot/ui";
import {
  AdjustmentsHorizontalIcon,
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

const RAW_ROOM_COPY_MAP: Record<
  string,
  {
    title: string;
    promise: string;
    live: string;
  }
> = {
  dice: { title: "Precision Dice", promise: "1-99 sizing in seconds.", live: "124" },
  roulette: {
    title: "European Roulette",
    promise: "Classic 37-slot physical mechanics.",
    live: "312"
  },
  "coin-toss": { title: "Coin Toss", promise: "High-speed 50/50 resolution.", live: "89" },
  keno: { title: "Keno Draft", promise: "Pick multi-spots for massive multipliers.", live: "45" }
};

const ROOM_THEME_MAP: Record<
  string,
  {
    cardHover: string;
    gradientFrom: string;
    badgeTag: string;
    badgeStyle: string;
    iconHoverTransform: string;
    buttonHover: string;
  }
> = {
  dice: {
    cardHover: "hover:border-purple-500/60 hover:shadow-[0_20px_50px_rgba(168,85,247,0.2)]",
    gradientFrom: "from-purple-500/10",
    badgeTag: "1% House Edge",
    badgeStyle: "bg-purple-500/20 border-purple-500/50 text-purple-300",
    iconHoverTransform: "group-hover:scale-110",
    buttonHover:
      "group-hover:bg-purple-500/10 group-hover:border-purple-500/50 group-hover:text-purple-400 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]"
  },
  roulette: {
    cardHover: "hover:border-emerald-500/60 hover:shadow-[0_20px_50px_rgba(16,185,129,0.2)]",
    gradientFrom: "from-emerald-500/10",
    badgeTag: "Max Payout 36x",
    badgeStyle: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
    iconHoverTransform: "group-hover:scale-110 group-hover:-rotate-12",
    buttonHover:
      "group-hover:bg-emerald-500/10 group-hover:border-emerald-500/50 group-hover:text-emerald-400 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
  },
  "coin-toss": {
    cardHover: "hover:border-amber-500/60 hover:shadow-[0_20px_50px_rgba(245,158,11,0.2)]",
    gradientFrom: "from-amber-500/10",
    badgeTag: "1% House Edge",
    badgeStyle: "bg-amber-500/20 border-amber-500/50 text-amber-300",
    iconHoverTransform: "group-hover:scale-110 group-hover:rotate-180",
    buttonHover:
      "group-hover:bg-amber-500/10 group-hover:border-amber-500/50 group-hover:text-amber-400 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]"
  },
  keno: {
    cardHover: "hover:border-fuchsia-500/60 hover:shadow-[0_20px_50px_rgba(217,70,239,0.2)]",
    gradientFrom: "from-fuchsia-500/10",
    badgeTag: "Huge 1,000x Win",
    badgeStyle: "bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300",
    iconHoverTransform: "group-hover:scale-110",
    buttonHover:
      "group-hover:bg-fuchsia-500/10 group-hover:border-fuchsia-500/50 group-hover:text-fuchsia-400 group-hover:shadow-[0_0_15px_rgba(217,70,239,0.2)]"
  }
};

const DEFAULT_THEME = ROOM_THEME_MAP["dice"]!;

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
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-blue-500/30">
      {/* Immersive Deep Glow Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[700px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[120px] pointer-events-none rounded-full z-0" />
      <div className="fixed top-0 left-0 right-0 h-[600px] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.12] mix-blend-overlay pointer-events-none z-0" />

      <main className="relative z-10 max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        {/* 1. GRAND LOBBY HEADER */}
        <header className="mb-16 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="max-w-2xl relative">
            <div className="absolute -left-10 top-0 w-32 h-32 bg-blue-500/20 blur-[50px] rounded-full pointer-events-none" />
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-[10px] font-bold uppercase tracking-widest mb-6 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.15)] relative z-10 text-shadow-sm">
              <SparklesIcon className="w-4 h-4" /> Global Casino Lobby
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/50 relative z-10 leading-tight">
              Enter the Floor
            </h1>
            <p className="text-lg md:text-xl text-white/50 leading-relaxed font-medium relative z-10">
              All modules are 100% on-chain, verifiable, and connected directly to the isolated
              reserve bank. Play directly from your wallet.
            </p>
          </div>

          {/* Glassmorphism Stats Cards */}
          <div className="flex flex-col sm:flex-row gap-4 relative z-10">
            <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-[#0a0a0a]/60 backdrop-blur-xl p-5 min-w-[180px] shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="text-[10px] text-emerald-500/80 uppercase tracking-widest font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />{" "}
                Live Players
              </span>
              <span className="text-3xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] mt-2">
                1,842
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-[#0a0a0a]/60 backdrop-blur-xl p-5 min-w-[200px] shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="text-[10px] text-amber-500/80 uppercase tracking-widest font-bold flex items-center gap-2">
                <TrophyIcon className="w-3 h-3" /> Max Win (24H)
              </span>
              <span className="text-3xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(245,158,11,0.3)] mt-2">
                $35,000
              </span>
            </div>
          </div>
        </header>

        {/* 2. SLEEK SEARCH & FILTERS */}
        <div className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-6">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar w-full md:w-auto">
            {FILTERS.map((item) => {
              const isActive = item.key === filter;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    "px-6 py-3 text-sm font-bold flex-shrink-0 transition-all rounded-full relative",
                    isActive
                      ? "text-white bg-white/10 shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
                      : "text-white/40 hover:text-white/80 hover:bg-white/5"
                  )}
                >
                  {item.label}
                  {isActive && (
                    <div className="absolute -bottom-[25px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-blue-500 rounded-t-full shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80 group">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-white/80 transition-colors z-10" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games..."
              className="w-full bg-[#0a0a0a] border border-white/10 hover:border-white/20 rounded-full pl-12 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500 focus:bg-[#0f0f0f] focus:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all shadow-inner relative z-0"
            />
          </div>
        </div>

        {/* 3. PREMIUM GAME CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {roomsToRender.map((room) => {
            const copy = RAW_ROOM_COPY_MAP[room.slug] ?? {
              title: room.label,
              promise: room.summary,
              live: "—"
            };
            const theme = ROOM_THEME_MAP[room.slug] ?? DEFAULT_THEME;

            return (
              <Link
                key={room.slug}
                href={room.href}
                data-testid="room-entry-card"
                data-slug={room.slug}
                className={cn(
                  "group relative rounded-[2rem] border border-white/10 bg-[#050505] overflow-hidden hover:-translate-y-2 transition-all duration-300 flex flex-col min-h-[380px]",
                  theme.cardHover
                )}
              >
                {/* Ambient Drop Glow */}
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-b from-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                    theme.gradientFrom
                  )}
                />

                {/* Badges */}
                <div className="absolute top-4 left-4 z-20 pointer-events-none">
                  <div className="px-3 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]" />
                    <span className="text-[10px] font-mono font-bold text-white/80 uppercase tracking-widest">
                      {copy.live} playing
                    </span>
                  </div>
                </div>

                <div className="absolute top-4 right-4 z-20 pointer-events-none">
                  <div
                    className={cn(
                      "px-3 py-1 text-[10px] uppercase font-bold rounded-full backdrop-blur-md border",
                      theme.badgeStyle
                    )}
                  >
                    {theme.badgeTag}
                  </div>
                </div>

                {/* 3D Game Icon Viewer */}
                <div className="flex-1 p-6 relative z-10 flex items-center justify-center mt-8">
                  <div
                    className={cn("transition-transform duration-700", theme.iconHoverTransform)}
                  >
                    {ROOM_ICON_MAP[room.slug] ?? (
                      <div className="text-3xl font-bold opacity-30">[{room.slug}]</div>
                    )}
                  </div>
                </div>

                {/* Card Details & Hover CTA */}
                <div className="p-6 border-t border-white/5 bg-[#0a0a0a]/90 relative z-20 backdrop-blur-xl">
                  <h3 className="text-2xl font-bold text-white mb-2">{copy.title}</h3>
                  <p className="text-white/40 text-sm mb-6 h-10 leading-relaxed">{copy.promise}</p>

                  <button
                    className={cn(
                      "w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-sm transition-all duration-300",
                      "bg-[#0f0f0f] border border-white/5 text-white/50",
                      theme.buttonHover
                    )}
                  >
                    Play Now <PlayCircleIcon className="w-5 h-5 flex-shrink-0" />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 4. PROGRESSIVE JACKPOT BANNER */}
        <div className="rounded-[2.5rem] border border-amber-500/20 bg-gradient-to-b from-[#1a1400] to-[#0a0a0a] p-1 relative overflow-hidden group">
          {/* Cinematic Lighting */}
          <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[300px] bg-amber-500/20 blur-[100px] pointer-events-none group-hover:bg-amber-500/30 transition-colors duration-1000" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />

          <div className="rounded-[2.4rem] bg-[#050505]/60 backdrop-blur-xl px-8 py-10 md:py-14 flex flex-col md:flex-row items-center justify-between gap-10 relative z-10 border border-amber-500/10 shadow-[inset_0_0_50px_rgba(245,158,11,0.05)]">
            <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-[0_0_40px_rgba(245,158,11,0.4)] flex-shrink-0">
                <div className="w-full h-full rounded-[15px] bg-[#1a1400] flex items-center justify-center">
                  <TrophyIcon className="w-10 h-10 text-amber-500" />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-black text-white mb-2 tracking-tight">
                  Progressive Reserve Pool
                </h3>
                <p className="text-amber-500/60 font-medium font-mono text-sm uppercase tracking-widest">
                  Transparent • Verifiable • Unlocked
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end">
              <div className="text-5xl md:text-7xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-[0_0_30px_rgba(245,158,11,0.5)] tracking-tighter">
                $1,452,093<span className="text-3xl text-amber-500/50">.42</span>
              </div>
              <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-amber-500 tracking-widest">
                  Yielding Real Time
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
