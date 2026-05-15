"use client";

import { useQuery } from "@tanstack/react-query";

import { useSSOTRuntime } from "../../../ssot/runtime";

export function useTxJournal(limit = 50) {
  const { db } = useSSOTRuntime();
  return useQuery({
    queryKey: ["ssot", "txJournal", limit],
    enabled: Boolean(db),
    queryFn: async () => {
      if (!db) return [];
      return await db.txJournal.orderBy("createdAt").reverse().limit(limit).toArray();
    },
    refetchInterval: 2000
  });
}
