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

  return (
    <PageTransition pageKey="games-list">
      <div className="space-y-8 py-6">
        <section className="ag-room-panel overflow-hidden rounded-[2.15rem] px-5 py-6 sm:px-7 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-4">
            {games.map((game, index) => (
              <Link
                key={game.slug}
                href={`/games/${game.slug}`}
                data-active={index === 0}
                className="ag-pill-tab min-w-max px-4 py-2 text-sm"
              >
                {game.label}
              </Link>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <ArbiGameFiLockup className="hidden h-11 w-auto lg:block" />
                <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  Game directory
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="max-w-4xl text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
                  Enter a room the same way you would enter a real casino floor.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
                  Top-level choice first. Room detail second. The directory is built for scanning
                  live tables, not deciphering protocol internals.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Live rooms
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">{games.length}</div>
                  <div className="mt-1 text-sm text-slate-400">One selector, one entrance per table</div>
                </div>
                <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Assets
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">{release.assets.length}</div>
                  <div className="mt-1 text-sm text-slate-400">Wallet-native bankroll context</div>
                </div>
                <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Flow
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">Room-first</div>
                  <div className="mt-1 text-sm text-slate-400">Slip on the side, table in focus</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={`/games/${featuredGame.slug}`}>Open {featuredGame.label}</Link>
                </Button>
                <Button asChild variant="glass" size="lg">
                  <Link href="/bets">See live bets</Link>
                </Button>
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-[1.8rem] border border-white/8 p-5 ${featuredPresentation.theme.stageClassName}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ArbiGameFiMark accent="cyan" className="h-12 w-12 rounded-[1rem]" />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Featured table
                    </div>
                    <div className="text-sm font-semibold text-white">{featuredGame.label}</div>
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-[#050714]/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                  Ready now
                </div>
              </div>

              <div className="mt-6 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-[#050714]/35 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                    {featuredPresentation.roomLabel}
                  </div>
                  <div className="mt-4 text-4xl font-black tracking-tight text-white">{featuredGame.label}</div>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
                    {featuredPresentation.roomSummary}
                  </p>
                </div>
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-white/10 bg-[#050714]/35 text-4xl">
                  {featuredPresentation.icon}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {featuredPresentation.previewSteps.slice(0, 3).map((step, index) => (
                  <div key={step.title} className="flex items-start gap-4 rounded-[1.2rem] border border-white/8 bg-[#050714]/28 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{step.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {featuredPresentation.cardFacts.map((fact) => (
                  <span key={fact} className="rounded-full border border-white/10 bg-[#050714]/35 px-3 py-1.5 text-xs font-semibold text-slate-200">
                    {fact}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Live room lineup</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Browse by room, not by module.</h2>
            </div>
            <Link href="/liquidity" className="text-sm font-semibold text-cyan-100">
              View bankroll context
            </Link>
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
