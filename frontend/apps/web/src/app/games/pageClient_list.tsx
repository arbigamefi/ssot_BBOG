"use client";

import * as React from "react";
import Link from "next/link";
import { Button, GameCard, PageHeader, ReleaseBadge, StatCard } from "@ssot/ui";

import { Placeholder } from "../../components/Placeholder";
import { PageTransition } from "../../components/PageTransition";
import { getGamePresentation } from "../../features/games/presentation";
import { useRelease } from "../../ssot/release/ReleaseProvider";

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

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
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/60 px-6 py-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <ReleaseBadge
                  networkName={release.name}
                  hubShort={shortHex(release.contracts.hub)}
                  digestShort={release.releaseDigest.slice(0, 8)}
                />
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Room Directory
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
                  Choose a live room, not a generic widget.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
                  Every room below is resolved from the active release manifest. Presentation can be expressive, but route validity,
                  params encoding, module routing, and supported assets still come from protocol truth.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={`/games/${featuredGame.slug}`}>Enter Featured Room</Link>
                </Button>
                <Button asChild variant="glass" size="lg">
                  <Link href="/bets">Open Ledger</Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Live Rooms" value={String(games.length)} subValue="release-driven" />
                <StatCard label="Assets" value={String(release.assets.length)} subValue="bank-backed" />
                <StatCard label="Digest" value={release.releaseDigest.slice(0, 8)} subValue="active bundle" />
                <StatCard label="Routing" value="On-chain" subValue="wallet-native" />
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 p-6 shadow-2xl ${featuredPresentation.theme.stageClassName}`}>
              <div className="pointer-events-none absolute -right-10 -top-10 text-[7rem] opacity-10">
                {featuredPresentation.icon}
              </div>

              <div className="relative space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${featuredPresentation.theme.badgeClassName}`}>
                      {featuredPresentation.roomLabel}
                    </div>
                    <div className="mt-4 text-3xl font-black tracking-tight text-white">
                      {featuredGame.label}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{featuredPresentation.roomSummary}</p>
                  </div>
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-slate-950/45 text-4xl shadow-lg shadow-black/20">
                    {featuredPresentation.icon}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Featured room notes</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-slate-500">Params</div>
                      <div className="mt-1 font-mono text-slate-100">{featuredGame.paramsEncoding ?? "release-defined"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Module</div>
                      <div className="mt-1 font-mono text-slate-100">{shortHex(featuredGame.module)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {featuredPresentation.playbook.slice(0, 2).map((item, index) => (
                    <div key={`${featuredGame.slug}-hero-${index}`} className="flex items-start gap-3">
                      <div className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${featuredPresentation.theme.badgeClassName}`}>
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-6">
            <PageHeader
              title="Room Directory"
              description="Each room keeps its own tone and control surface, but every route is still locked to the active release manifest."
            />

            <div className="grid gap-6 sm:grid-cols-2" data-testid="games-grid">
              {games.map((g) => {
                const presentation = getGamePresentation(g.slug, g.label);
                return (
                  <Link key={g.slug} href={`/games/${g.slug}`} className="block">
                    <GameCard
                      slug={g.slug}
                      label={g.label}
                      icon={presentation.icon}
                      badge={presentation.roomLabel}
                      description={presentation.listDescription}
                      summary={presentation.roomSummary}
                      facts={[g.paramsEncoding ?? "release-defined", shortHex(g.module), `${release.assets.length} assets`]}
                      ctaLabel="Enter Room"
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-6 shadow-xl shadow-slate-950/40 backdrop-blur-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selection rules</div>
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
                <p>Use governed presentation to choose a room quickly, then rely on release truth once you enter it.</p>
                <p>Do not treat room styling as protocol fact. Supported assets, params encoding, and module routing remain canonical only in the release.</p>
                <p>If a room disappears from this directory, the active release no longer exposes it. No hidden aliases or legacy routes are used.</p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-6 shadow-xl shadow-slate-950/40 backdrop-blur-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fast paths</div>
              <div className="mt-4 grid gap-3 text-sm">
                <Link href={`/games/${featuredGame.slug}`} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3 text-slate-200 transition-colors hover:border-slate-700 hover:bg-slate-800/40">
                  Open {featuredGame.label}
                </Link>
                <Link href="/bets" className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3 text-slate-200 transition-colors hover:border-slate-700 hover:bg-slate-800/40">
                  Inspect recent bets
                </Link>
                <Link href="/ops" className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3 text-slate-200 transition-colors hover:border-slate-700 hover:bg-slate-800/40">
                  Check indexer health
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
