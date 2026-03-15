"use client";

import * as React from "react";
import Link from "next/link";
import { Button, GameCard } from "@ssot/ui";

import { ArbiGameFiLockup, ArbiGameFiMark } from "../../components/ArbiGameFiBrand";
import { Placeholder } from "../../components/Placeholder";
import { PageTransition } from "../../components/PageTransition";
import { getGamePresentation } from "../../features/games/presentation";
import { useRelease } from "../../ssot/release/ReleaseProvider";

export function GamesListClient() {
  const { release, readOnlyReason } = useRelease();

  if (!release) {
    return (
      <Placeholder
        title="Games"
        description={readOnlyReason ?? "No embedded release available for the connected chain."}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );
  }

  const games = release.gamesMeta ?? [];

  if (games.length === 0) {
    return (
      <Placeholder
        title="Games"
        description="No games registered in the release bundle. Sync the latest release bundle and retry."
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );
  }

  const featuredGame = games[0]!;
  const featuredPresentation = getGamePresentation(featuredGame.slug, featuredGame.label);

  const categories = ["All Rooms", "Table", "Originals", "Fast Entry"];

  return (
    <PageTransition pageKey="games-list">
      <div className="mx-auto max-w-[1440px] px-6 py-12 md:py-16">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">Room directory</div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Choose a room and get straight to the table.</h1>
            <p className="mt-4 text-lg text-white/50 leading-relaxed max-w-2xl">
              Room-first selection. Pick the pace, read the ticket style, and enter without digging through protocol mechanics.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-xl border border-white/5 bg-[#0a0a0a] p-1">
            {categories.map((category, index) => (
              <button
                key={category}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-bold transition-all",
                  index === 0 ? "bg-white/10 text-white shadow" : "text-white/40 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <section className="mb-20 grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Link href={`/games/${featuredGame.slug}`} className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 min-h-[460px] flex flex-col justify-between transition-all hover:border-white/20">
            <div className={`absolute right-0 top-0 h-96 w-96 blur-[120px] transition-colors group-hover:opacity-80 opacity-60 ${featuredPresentation.theme.stageClassName}`} />
            
            <div className="relative flex flex-col h-full justify-between gap-10">
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">
                  Featured room
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  {featuredPresentation.roomLabel}
                </div>
              </div>

              <div className="max-w-xl">
                <h2 className="text-4xl font-bold tracking-tight">{featuredGame.label}</h2>
                <p className="mt-4 max-w-md text-white/55 leading-relaxed">
                  {featuredPresentation.roomSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-[1.5rem] border border-white/8 bg-black/25 p-4">
                {featuredPresentation.cardFacts.slice(0, 3).map((item) => (
                  <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm font-medium text-white/75 flex items-center justify-center text-center">
                    {item}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-6">
                <div className="text-xs text-white/45 hidden sm:block">Standard protocol settlement with institutional-grade auditability.</div>
                <span className="text-sm font-bold text-blue-400 group-hover:translate-x-1 transition-transform">Enter Room →</span>
              </div>
            </div>
          </Link>

          <div className="grid grid-cols-1 gap-6">
            {games.slice(1, 4).map((game) => {
              const presentation = getGamePresentation(game.slug, game.label);
              return (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  className="group flex min-h-[170px] flex-col rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-6 transition-all hover:bg-white/[0.05] hover:border-white/20 relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] -z-10 group-hover:bg-indigo-500/20 transition-colors" />
                   <div className="flex items-start justify-between gap-4">
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                      {presentation.roomLabel}
                    </div>
                    <div className="text-xs font-medium text-blue-400 transition-transform group-hover:translate-x-1">Enter →</div>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{game.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/55 line-clamp-2">{presentation.listDescription}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4 mb-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Live room lineup</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Browse by room, not by module.</h2>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {games.map((game) => {
              const presentation = getGamePresentation(game.slug, game.label);
              return (
                <Link key={game.slug} href={`/games/${game.slug}`} className="block">
                  <GameCard
                    slug={game.slug}
                    label={game.label}
                    icon={presentation.icon}
                    badge={presentation.roomLabel}
                    description={presentation.listDescription}
                    summary={presentation.roomSummary}
                    facts={presentation.cardFacts}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
