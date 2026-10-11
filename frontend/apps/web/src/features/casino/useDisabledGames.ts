"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

/**
 * Lowercased gameIds GameHub has disabled for good (ADR-0037 §6). Undefined until read; a failed
 * read hides nothing, because the room itself reads the flag again before taking a bet.
 */
export function useDisabledGameIds(): ReadonlySet<string> | undefined {
  const { release, chainId } = useRelease();
  const { sdk } = useSSOTSDK();
  const gameIds = React.useMemo(
    () => (release?.gamesMeta ?? []).map((game) => game.gameId as `0x${string}`),
    [release?.gamesMeta]
  );
  const query = useQuery({
    queryKey: ["ssot", "gameDisabled", chainId, release?.releaseDigest, gameIds.join(",")],
    enabled: Boolean(sdk && gameIds.length > 0),
    queryFn: async () => {
      const flags = await Promise.all(gameIds.map((gameId) => sdk!.gameHub.isGameDisabled(gameId)));
      return new Set(
        gameIds.filter((_, index) => flags[index]).map((gameId) => gameId.toLowerCase())
      ) as ReadonlySet<string>;
    },
    staleTime: 60_000,
    refetchInterval: 60_000
  });
  return query.data;
}

/** Drops rooms whose release game is disabled. */
export function withoutDisabledRooms<T extends { slug: string }>(
  rooms: readonly T[],
  gamesMeta: readonly { slug: string; gameId: string }[] | undefined,
  disabled: ReadonlySet<string> | undefined
) {
  if (!disabled || disabled.size === 0) return [...rooms];
  const closedSlugs = new Set(
    (gamesMeta ?? [])
      .filter((game) => disabled.has(game.gameId.toLowerCase()))
      .map((game) => game.slug)
  );
  return rooms.filter((room) => !closedSlugs.has(room.slug));
}
