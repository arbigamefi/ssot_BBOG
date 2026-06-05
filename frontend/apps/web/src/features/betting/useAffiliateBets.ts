"use client";

import { useQuery } from "@tanstack/react-query";

import type { AffiliateBetsResponse } from "./recent-bets";

export function useAffiliateBets({
  affiliate,
  asset,
  chainId,
  enabled = true,
  limit = 25
}: {
  affiliate?: string | null;
  asset?: string | null;
  chainId?: number | null;
  enabled?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: [
      "ssot",
      "bets",
      "affiliate",
      chainId ?? "unknown",
      affiliate ?? "anonymous",
      asset ?? "all-assets",
      limit
    ],
    enabled: Boolean(enabled && affiliate && chainId),
    queryFn: async () => {
      if (!affiliate || !chainId) {
        throw new Error("Affiliate bets query is not ready.");
      }
      const params = new URLSearchParams({
        chainId: String(chainId),
        limit: String(limit)
      });
      if (asset) params.set("asset", asset);
      const response = await fetch(`/api/bets/affiliate/${affiliate}?${params.toString()}`, {
        cache: "no-store"
      });
      const body = (await response.json()) as
        | AffiliateBetsResponse
        | { error?: { message?: string } };
      if (!response.ok) {
        const errorBody = body as { error?: { message?: string } };
        throw new Error(errorBody.error?.message ?? "Failed to load affiliate bets.");
      }
      return body as AffiliateBetsResponse;
    },
    refetchInterval: 15_000
  });
}
