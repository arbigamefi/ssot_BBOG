"use client";

import type { Hex } from "@ssot/ssot/sdk";
import { useQuery } from "@tanstack/react-query";

import { useSSOTRuntime } from "../../ssot/runtime";
import { useRelease } from "../../ssot/release/ReleaseProvider";

export function useBetsByGame(gameId: Hex | undefined, limit = 20) {
  const { db } = useSSOTRuntime();
  const { chainId } = useRelease();

  return useQuery({
    queryKey: ["ssot", "bets", "byGame", chainId, gameId, limit],
    enabled: Boolean(db && gameId),
    queryFn: async () => {
      if (!db || !gameId) return [];
      const rows = await db.bets.where("chainId").equals(chainId).toArray();
      return rows
        .filter((r) => (r.gameId ?? "").toLowerCase() === gameId.toLowerCase())
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .slice(0, limit);
    },
    refetchInterval: 2000,
  });
}
