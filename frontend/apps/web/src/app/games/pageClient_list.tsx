"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader, GameCard } from "@ssot/ui";

import { Placeholder } from "../../components/Placeholder";
import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";

const GAME_META: Record<string, { icon: string; description: string; rtp: string }> = {
  dice: { icon: "🎲", description: "Classic over/under dice game", rtp: "99% RTP" },
  "coin-toss": { icon: "🪙", description: "Heads or tails — double or nothing", rtp: "98% RTP" },
  roulette: { icon: "🎯", description: "European roulette on-chain", rtp: "97.3% RTP" },
  keno: { icon: "🔢", description: "Pick your lucky numbers", rtp: "95% RTP" },
};

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

  return (
    <PageTransition pageKey="games-list">
      <PageHeader
        title="Games"
        description="Pick a game and start playing. All games are fully on-chain, non-custodial, and verifiably fair."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="games-grid">
        {games.map((g) => {
          const meta = GAME_META[g.slug] ?? { icon: "🎮", description: `Play ${g.label}`, rtp: "" };
          return (
            <Link key={g.slug} href={`/games/${g.slug}`} className="block">
              <GameCard
                slug={g.slug}
                label={g.label}
                icon={meta.icon}
                description={meta.description}
                rtp={meta.rtp}
              />
            </Link>
          );
        })}
      </div>
    </PageTransition>
  );
}
