"use client";

import * as React from "react";
import { useChainId, useConfig } from "wagmi";
import { getSSOTDb, createDexieJournalSink, type SSOTDb, type HubIndexerConfig } from "@ssot/ssot/indexer";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { SSOTRuntimeContext } from "../../ssot/runtime";
import { HubIndexerWorkerClient, type HubIndexerWorkerStatus } from "../../ssot/runtime/indexerWorkerClient";

/**
 * SSOTRuntimeProvider
 *
 * Provider wiring only (allowed to import wagmi).
 * - Creates the local Dexie DB
 * - Wires tx journal sink
 * - Starts the Hub indexer (events-as-facts)
 */
export function SSOTRuntimeProvider({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  const wagmiConfig = useConfig();
  const rel = useRelease();

  const db: SSOTDb | undefined = React.useMemo(() => {
    if (!rel.release) return undefined;
    // per-chain db name to avoid cross-chain mixing
    return getSSOTDb(`ssot_frontend_v2_${rel.release.chainId}`);
  }, [rel.release]);

  const journal = React.useMemo(() => {
    if (!db) return undefined;
    return createDexieJournalSink(db);
  }, [db]);

  // Indexer runs in a Web Worker for main-thread responsiveness.
  const workerRef = React.useRef<HubIndexerWorkerClient | null>(null);
  const [indexerStatus, setIndexerStatus] = React.useState<HubIndexerWorkerStatus | undefined>(undefined);

  const indexerConfig: HubIndexerConfig = React.useMemo(
    () => ({ confirmations: 12, pollIntervalMs: 10_000, batchSize: 2_000, rewindBlocks: 24 }),
    []
  );

  const rpcUrl = React.useMemo(() => {
    const chain = wagmiConfig.chains.find((c) => c.id === chainId);
    return chain?.rpcUrls?.default?.http?.[0] ?? chain?.rpcUrls?.public?.http?.[0];
  }, [wagmiConfig.chains, chainId]);

  const refreshIndexerStatus = React.useCallback(() => {
    workerRef.current?.refreshStatus();
  }, []);

  const syncNow = React.useCallback(async () => {
    workerRef.current?.syncOnce();
  }, []);

  React.useEffect(() => {
    // teardown on missing prereqs
    if (!rel.release || !db || rel.readOnly || !rpcUrl) {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      return;
    }

    // recreate worker on chain/release change
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    const client = new HubIndexerWorkerClient({
      init: {
        chainId: rel.release.chainId,
        rpcUrl,
        release: rel.release,
        config: indexerConfig,
        dbName: `ssot_frontend_v2_${rel.release.chainId}`,
      },
      onStatus: (s) => setIndexerStatus(s),
      onError: (e) => setIndexerStatus((prev) => ({
        ...(prev ?? { chainId: rel.release!.chainId, hub: rel.release!.contracts.hub as any, running: false, config: indexerConfig }),
        lastError: e.message,
      })),
    });

    workerRef.current = client;
    client.start();

    return () => {
      client.terminate();
      if (workerRef.current === client) workerRef.current = null;
    };
  }, [rel.release, rel.readOnly, db, rpcUrl, indexerConfig]);

  const value = React.useMemo(
    () => ({ db, indexer: undefined, indexerStatus, refreshIndexerStatus, syncNow, journal }),
    [db, indexerStatus, refreshIndexerStatus, syncNow, journal]
  );

  return <SSOTRuntimeContext.Provider value={value as any}>{children}</SSOTRuntimeContext.Provider>;
}
