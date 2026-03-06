"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader, GameCard } from "@ssot/ui";

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

  return (
    <PageTransition pageKey="games-list">
      <PageHeader
        title="Games"
        description="Pick a game and start playing. All games are fully on-chain, non-custodial, and verifiably fair."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="games-grid">
        {games.map((g) => {
          const presentation = getGamePresentation(g.slug, g.label);
          return (
            <Link key={g.slug} href={`/games/${g.slug}`} className="block">
              <GameCard
                slug={g.slug}
                label={g.label}
                icon={presentation.icon}
                description={presentation.listDescription}
              />
            </Link>
          );
        })}
      </div>
    </PageTransition>
  );
}
