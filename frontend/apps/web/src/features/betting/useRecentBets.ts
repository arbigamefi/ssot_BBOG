"use client";

import { useQuery } from "@tanstack/react-query";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import type { RecentBetsResponse } from "./recent-bets";

export function useRecentBets({
  enabled = true,
  gameId,
  limit = 20,
  errorMessage = "—"
}: {
  enabled?: boolean;
  gameId?: string;
  limit?: number;
  errorMessage?: string;
} = {}) {
  const { chainId } = useRelease();

  return useQuery({
    enabled,
    queryKey: ["ssot", "bets", "recent", { chainId, gameId, limit }],
    queryFn: async () => {
      const params = new URLSearchParams({
        chainId: String(chainId),
        limit: String(limit)
      });
      if (gameId) params.set("gameId", gameId);

      const response = await fetch(`/api/bets/recent?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      const body = (await response.json()) as RecentBetsResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in body ? (body.error?.message ?? errorMessage) : errorMessage);
      }
      return (body as RecentBetsResponse).rows;
    },
    refetchInterval: 5_000,
    staleTime: 8_000
  });
}
