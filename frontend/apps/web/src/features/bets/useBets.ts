"use client";

import { useQuery } from "@tanstack/react-query";
import { useSSOTRuntime } from "../../ssot/runtime";

export function useBets(limit = 50) {
  const { db } = useSSOTRuntime();
  return useQuery({
    queryKey: ["ssot", "bets", limit],
    enabled: Boolean(db),
    queryFn: async () => {
      if (!db) return [];
      return await db.bets.orderBy("updatedBlock").reverse().limit(limit).toArray();
    },
    refetchInterval: 2000
  });
}
