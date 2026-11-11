"use client";

import { useQuery } from "@tanstack/react-query";

import { useRelease } from "../../ssot/release/ReleaseProvider";
// Type-only import: erased at compile time, so the server-side viem/bet-index
// deps in casino-analytics never reach the client bundle.
import type {
  CasinoStatsResponse,
  CasinoTimeseriesResponse
} from "../../server/betting/casino-analytics";

/**
 * Public, account-agnostic casino analytics (turnover / bet count / unique
 * players / per-game volume) from the durable Postgres bet index. Falls back
 * to `source: "unavailable"` with zeroed values when Postgres is not wired —
 * the UI degrades gracefully and never blocks.
 */
export function useCasinoStats({
  asset,
  enabled = true,
  windowDays
}: { asset?: string; enabled?: boolean; windowDays?: number } = {}) {
  const { chainId } = useRelease();

  return useQuery<CasinoStatsResponse>({
    enabled,
    queryKey: ["ssot", "casino", "stats", { asset, chainId, windowDays }],
    queryFn: async () => {
      const params = new URLSearchParams({ chainId: String(chainId) });
      if (asset) params.set("asset", asset);
      if (windowDays) params.set("window", String(windowDays));
      const response = await fetch(`/api/casino/stats?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error("casino stats request failed");
      }
      return (await response.json()) as CasinoStatsResponse;
    },
    // Analytics is best-effort and changes slowly; poll gently.
    refetchInterval: 30_000,
    staleTime: 20_000
  });
}

/**
 * Daily casino volume/time-series from the durable bet index. The server
 * groups by chain placement timestamp, not index-write time, so backfills do
 * not distort the trend.
 */
export function useCasinoTimeseries({
  asset,
  days = 7,
  gameId,
  enabled = true
}: {
  asset?: string;
  days?: number;
  gameId?: string;
  enabled?: boolean;
} = {}) {
  const { chainId } = useRelease();

  return useQuery<CasinoTimeseriesResponse>({
    enabled,
    queryKey: ["ssot", "casino", "timeseries", { asset, chainId, days, gameId }],
    queryFn: async () => {
      const params = new URLSearchParams({
        chainId: String(chainId),
        days: String(days)
      });
      if (asset) params.set("asset", asset);
      if (gameId) params.set("gameId", gameId);
      const response = await fetch(`/api/casino/timeseries?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error("casino timeseries request failed");
      }
      return (await response.json()) as CasinoTimeseriesResponse;
    },
    refetchInterval: 30_000,
    staleTime: 20_000
  });
}
