"use client";

import * as React from "react";
import type { BetRow } from "@ssot/ssot/indexer";
import { useQuery } from "@tanstack/react-query";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTRuntime } from "../../ssot/runtime";
import type { PlayerBetsResponse } from "./recent-bets";

export function usePlayerBets({
  enabled = true,
  limit = 50,
  player,
  errorMessage = "—"
}: {
  enabled?: boolean;
  limit?: number;
  player?: string;
  errorMessage?: string;
}) {
  const { chainId } = useRelease();
  const { db } = useSSOTRuntime();
  const normalizedPlayer = player?.toLowerCase();

  const serverQuery = useQuery({
    enabled: Boolean(enabled && player),
    queryKey: ["ssot", "bets", "player", "server", { chainId, limit, player }],
    queryFn: async () => {
      if (!player) return [];
      const params = new URLSearchParams({
        chainId: String(chainId),
        limit: String(limit)
      });
      const response = await fetch(`/api/bets/player/${player}?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      const body = (await response.json()) as PlayerBetsResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in body ? (body.error?.message ?? errorMessage) : errorMessage);
      }
      return (body as PlayerBetsResponse).rows;
    },
    refetchInterval: 5_000,
    staleTime: 8_000
  });

  const localQuery = useQuery({
    enabled: Boolean(enabled && db && normalizedPlayer),
    queryKey: ["ssot", "bets", "player", "local", { chainId, limit, player: normalizedPlayer }],
    queryFn: async () => {
      if (!db || !normalizedPlayer) return [];
      const rows = await db.bets.where("chainId").equals(chainId).toArray();
      return rows
        .filter((row) => row.player?.toLowerCase() === normalizedPlayer)
        .sort(compareBetRows)
        .slice(0, limit);
    },
    refetchInterval: 2_000,
    staleTime: 1_000
  });

  const data = React.useMemo(
    () => mergeBetRows(serverQuery.data ?? [], localQuery.data ?? [], limit),
    [limit, localQuery.data, serverQuery.data]
  );

  return {
    data,
    isLoading: serverQuery.isLoading || localQuery.isLoading,
    isFetching: serverQuery.isFetching || localQuery.isFetching,
    localRows: localQuery.data ?? [],
    serverRows: serverQuery.data ?? [],
    error: serverQuery.error ?? localQuery.error,
    refetch: () => {
      void serverQuery.refetch();
      void localQuery.refetch();
    }
  };
}

export function mergeBetRows(
  serverRows: readonly BetRow[],
  localRows: readonly BetRow[],
  limit: number
) {
  const merged = new Map<string, BetRow>();
  for (const row of serverRows) merged.set(row.id, row);
  for (const row of localRows) {
    const existing = merged.get(row.id);
    if (!existing || row.updatedBlock >= existing.updatedBlock) {
      merged.set(row.id, row);
    }
  }
  return [...merged.values()].sort(compareBetRows).slice(0, limit);
}

function compareBetRows(a: BetRow, b: BetRow) {
  if (b.updatedBlock !== a.updatedBlock) return b.updatedBlock - a.updatedBlock;
  const aId = BigInt(a.betId);
  const bId = BigInt(b.betId);
  if (bId === aId) return 0;
  return bId > aId ? 1 : -1;
}
