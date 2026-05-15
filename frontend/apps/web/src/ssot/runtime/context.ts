"use client";

import * as React from "react";
import type { SSOTDb } from "@ssot/ssot/indexer";
import type { JournalSink } from "@ssot/ssot/sdk";
import type { GameHubIndexerWorkerStatus } from "./indexerWorkerClient";
import type { BankIndexerWorkerStatus } from "../../workers/bankIndexer.worker";

export type SSOTRuntimeContextValue = {
  db?: SSOTDb;
  /** Indexer runs in a Web Worker (no direct indexer instance is exposed to UI). */
  indexer?: undefined;
  indexerStatus?: GameHubIndexerWorkerStatus;
  bankIndexerStatus?: BankIndexerWorkerStatus;
  journal?: JournalSink;
  refreshIndexerStatus: () => void;
  syncNow: () => Promise<void>;
};

export const SSOTRuntimeContext = React.createContext<SSOTRuntimeContextValue | null>(null);

export function useSSOTRuntime(): SSOTRuntimeContextValue {
  const ctx = React.useContext(SSOTRuntimeContext);
  if (!ctx) throw new Error("useSSOTRuntime must be used within SSOTRuntimeProvider");
  return ctx;
}
