"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { SportsTicketRow } from "@ssot/bet-index";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import type { PlayerSportsTicketsResponse } from "./recent-tickets";

export function playerSportsTicketsQueryKey({
  chainId,
  limit,
  player
}: {
  chainId: number;
  limit: number;
  player?: string;
}) {
  return ["ssot", "sportsbook", "tickets", "player", { chainId, limit, player }] as const;
}

export function mergeSportsTicketRows(
  rows: readonly SportsTicketRow[] | undefined,
  optimistic: SportsTicketRow
) {
  const byId = new Map<string, SportsTicketRow>();
  for (const row of rows ?? []) byId.set(row.id, row);
  byId.set(optimistic.id, { ...byId.get(optimistic.id), ...optimistic });
  return [...byId.values()].sort(compareSportsTicketRows);
}

export function usePlayerSportsTickets({
  enabled = true,
  limit = 100,
  player,
  errorMessage = "—"
}: {
  enabled?: boolean;
  limit?: number;
  player?: string;
  errorMessage?: string;
}) {
  const { chainId } = useRelease();

  const query = useQuery({
    enabled: Boolean(enabled && player),
    queryKey: playerSportsTicketsQueryKey({ chainId, limit, player }),
    queryFn: async () => {
      if (!player) return [];
      const params = new URLSearchParams({
        chainId: String(chainId),
        limit: String(limit)
      });
      const response = await fetch(
        `/api/sportsbook/tickets/player/${player}?${params.toString()}`,
        {
          headers: { accept: "application/json" }
        }
      );
      const body = (await response.json()) as
        | PlayerSportsTicketsResponse
        | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(errorMessage);
      }
      return (body as PlayerSportsTicketsResponse).rows;
    },
    refetchInterval: 5_000,
    staleTime: 8_000
  });

  const data = React.useMemo(
    () => [...(query.data ?? [])].sort(compareSportsTicketRows).slice(0, limit),
    [limit, query.data]
  );

  return {
    data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => {
      void query.refetch();
    }
  };
}

function compareSportsTicketRows(a: SportsTicketRow, b: SportsTicketRow) {
  if (b.updatedBlock !== a.updatedBlock) return b.updatedBlock - a.updatedBlock;
  const aId = BigInt(a.ticketId);
  const bId = BigInt(b.ticketId);
  if (bId === aId) return 0;
  return bId > aId ? 1 : -1;
}
