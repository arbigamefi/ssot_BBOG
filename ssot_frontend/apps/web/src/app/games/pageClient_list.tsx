"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CopyButton } from "@ssot/ui";

import { Placeholder } from "../../components/Placeholder";
import { useRelease } from "../../ssot/release/ReleaseProvider";

function shortHex(addr: string) {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Games</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((g) => (
          <Link key={g.slug} href={`/games/${g.slug}`} className="block">
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>{g.label}</CardTitle>
                <CardDescription>/{g.slug}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  Module: {shortHex(g.module)}
                  <CopyButton value={g.module} label="Copy module address" />
                </p>
                {g.paramsEncoding ? (
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {g.paramsEncoding}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
