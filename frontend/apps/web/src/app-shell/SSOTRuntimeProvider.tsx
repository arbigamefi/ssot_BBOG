"use client";

import * as React from "react";
import {
  createDexieJournalSink,
  getSSOTDb,
  type HubIndexerConfig,
  type SSOTDb
} from "@ssot/ssot/indexer";
import { useChainId, useConfig } from "wagmi";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { SSOTRuntimeContext } from "../ssot/runtime";
import {
  HubIndexerWorkerClient,
  type HubIndexerWorkerStatus
} from "../ssot/runtime/indexerWorkerClient";

export function SSOTRuntimeProvider({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  const wagmiConfig = useConfig();
  const rel = useRelease();

  const db: SSOTDb | undefined = React.useMemo(() => {
    if (!rel.release) return undefined;
    return getSSOTDb(`ssot_frontend_v2_${rel.release.chainId}`);
  }, [rel.release]);

  const journal = React.useMemo(() => {
    if (!db) return undefined;
    return createDexieJournalSink(db);
  }, [db]);

  const workerRef = React.useRef<HubIndexerWorkerClient | null>(null);
  const [indexerStatus, setIndexerStatus] = React.useState<HubIndexerWorkerStatus | undefined>(
    undefined
  );

  const indexerConfig: HubIndexerConfig = React.useMemo(
    () => ({ batchSize: 2_000, confirmations: 12, pollIntervalMs: 10_000, rewindBlocks: 24 }),
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
    if (!rel.release || !db || rel.readOnly || !rpcUrl) {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      return;
    }

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    const client = new HubIndexerWorkerClient({
      init: {
        chainId: rel.release.chainId,
        config: indexerConfig,
        dbName: `ssot_frontend_v2_${rel.release.chainId}`,
        release: rel.release,
        rpcUrl
      },
      onError: (e) =>
        setIndexerStatus((prev) => ({
          ...(prev ?? {
            chainId: rel.release!.chainId,
            config: indexerConfig,
            hub: rel.release!.contracts.hub as any,
            running: false
          }),
          lastError: e.message
        })),
      onStatus: (s) => setIndexerStatus(s)
    });

    workerRef.current = client;
    client.start();

    return () => {
      client.terminate();
      if (workerRef.current === client) workerRef.current = null;
    };
  }, [rel.release, rel.readOnly, db, rpcUrl, indexerConfig]);

  const value = React.useMemo(
    () => ({ db, indexer: undefined, indexerStatus, journal, refreshIndexerStatus, syncNow }),
    [db, indexerStatus, journal, refreshIndexerStatus, syncNow]
  );

  return <SSOTRuntimeContext.Provider value={value as any}>{children}</SSOTRuntimeContext.Provider>;
}
