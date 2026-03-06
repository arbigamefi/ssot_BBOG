"use client";

import { useSSOTRuntime } from "../../ssot/runtime";

export function useIndexerStatus() {
  const { indexerStatus, refreshIndexerStatus, syncNow } = useSSOTRuntime();
  return { indexerStatus, refreshIndexerStatus, syncNow };
}
