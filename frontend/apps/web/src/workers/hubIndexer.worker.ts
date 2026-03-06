/*
 * Hub Indexer Worker
 *
 * Runs the SSOT Hub indexer off the main thread.
 * - Reads the release snapshot passed from the UI.
 * - Creates a viem public client using an explicit RPC URL.
 * - Uses the shared Dexie DB name (per-chain) so the UI can read derived tables.
 * - Posts status updates for lag/confirmations visualizations.
 */

import { createPublicClient, http } from "viem";
import { createHubIndexer, getSSOTDb, type HubIndexer, type HubIndexerConfig, type HubIndexerStatus } from "@ssot/ssot/indexer";
import type { SSOTRelease } from "@ssot/ssot/release";

type WorkerInit = {
  chainId: number;
  rpcUrl: string;
  release: SSOTRelease;
  config: HubIndexerConfig;
  dbName: string;
};

export type HubIndexerWorkerStatus = HubIndexerStatus & {
  running: boolean;
  config: HubIndexerConfig;
  safeHeadBlock?: number;
  lagBlocks?: number;
};

type ToWorkerMessage =
  | { type: "INIT"; payload: WorkerInit }
  | { type: "START" }
  | { type: "STOP" }
  | { type: "SYNC_ONCE" }
  | { type: "GET_STATUS" };

type FromWorkerMessage =
  | { type: "READY" }
  | { type: "STATUS"; payload: HubIndexerWorkerStatus }
  | { type: "ERROR"; payload: { message: string; stack?: string } };

let init: WorkerInit | undefined;
let indexer: HubIndexer | undefined;
let running = false;
let statusTimer: any | undefined;

function post(msg: FromWorkerMessage) {
  (self as any).postMessage(msg);
}

function computeDerivedStatus(base: HubIndexerStatus, cfg: HubIndexerConfig): HubIndexerWorkerStatus {
  const latestBlock = base.latestBlock;
  const safeHead = typeof latestBlock === "number" ? Math.max(0, latestBlock - cfg.confirmations) : undefined;
  const lastSynced = base.lastSyncedBlock;
  const lag = typeof safeHead === "number" && typeof lastSynced === "number" ? Math.max(0, safeHead - lastSynced) : undefined;
  return {
    ...base,
    running,
    config: cfg,
    safeHeadBlock: safeHead,
    lagBlocks: lag,
  };
}

async function ensureIndexer(): Promise<void> {
  if (!init) throw new Error("Indexer worker not initialized");
  if (indexer) return;

  const chain = {
    id: init.chainId,
    name: `chain-${init.chainId}`,
    nativeCurrency: { name: "Native", symbol: "NATIVE", decimals: 18 },
    rpcUrls: {
      default: { http: [init.rpcUrl] },
      public: { http: [init.rpcUrl] },
    },
  } as any;

  const publicClient = createPublicClient({
    chain,
    transport: http(init.rpcUrl),
  });

  const db = getSSOTDb(init.dbName);

  indexer = createHubIndexer({
    release: init.release,
    publicClient: publicClient as any,
    db,
    config: init.config,
  });
}

function emitStatus() {
  if (!init || !indexer) return;
  const s = indexer.getStatus();
  post({ type: "STATUS", payload: computeDerivedStatus(s, init.config) });
}

async function syncOnce() {
  await ensureIndexer();
  if (!indexer || !init) return;
  await indexer.syncOnce();
  emitStatus();
}

function start() {
  if (!init) return;
  running = true;
  // NOTE: createHubIndexer uses its own poll loop; we still emit UI status frequently.
  if (indexer) indexer.start();
  if (!statusTimer) {
    statusTimer = setInterval(() => emitStatus(), 1500);
  }
  emitStatus();
}

function stop() {
  running = false;
  if (indexer) indexer.stop();
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = undefined;
  }
  emitStatus();
}

self.onmessage = async (ev: MessageEvent<ToWorkerMessage>) => {
  try {
    const msg = ev.data;
    switch (msg.type) {
      case "INIT": {
        init = msg.payload;
        // Create immediately so we can validate early (bad rpc / bad release)
        await ensureIndexer();
        post({ type: "READY" });
        emitStatus();
        return;
      }
      case "START": {
        await ensureIndexer();
        start();
        return;
      }
      case "STOP": {
        stop();
        return;
      }
      case "SYNC_ONCE": {
        await syncOnce();
        return;
      }
      case "GET_STATUS": {
        emitStatus();
        return;
      }
      default:
        return;
    }
  } catch (e: any) {
    post({
      type: "ERROR",
      payload: {
        message: e?.message ? String(e.message) : String(e),
        stack: e?.stack ? String(e.stack) : undefined,
      },
    });
  }
};
