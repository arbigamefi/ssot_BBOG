"use client";

import { useQuery } from "@tanstack/react-query";

import type { AffiliateBetsResponse } from "./recent-bets";

export function useAffiliateBets({
  affiliate,
  chainId,
  enabled = true,
  limit = 25
}: {
  affiliate?: string | null;
  chainId?: number | null;
  enabled?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["ssot", "bets", "affiliate", chainId ?? "unknown", affiliate ?? "anonymous", limit],
    enabled: Boolean(enabled && affiliate && chainId),
    queryFn: async () => {
      if (!affiliate || !chainId) {
        throw new Error("Affiliate bets query is not ready.");
      }
      const response = await fetch(
        `/api/bets/affiliate/${affiliate}?chainId=${chainId}&limit=${limit}`,
        {
          cache: "no-store"
        }
      );
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
