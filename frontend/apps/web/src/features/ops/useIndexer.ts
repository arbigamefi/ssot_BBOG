"use client";

import { useSSOTRuntime } from "../../ssot/runtime";

export function useIndexer() {
  const { indexerStatus, syncNow, refreshIndexerStatus } = useSSOTRuntime();
  return { indexerStatus, syncNow, refreshIndexerStatus };
}
