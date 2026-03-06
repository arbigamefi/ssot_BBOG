/*
 * Bank Indexer Worker
 *
 * Runs the SSOT Bank indexer off the main thread.
 * - Indexes Bank events: BetSettled, XPAwarded, XPLockedUnlocked, XPHoldbackReleased, XPAccruedClaimed
 * - Uses shared Dexie DB for cross-thread reads (UI reads xpSnapshots/bankEvents).
 * - Posts status updates for lag/confirmations visualizations.
 */

import { createPublicClient, http } from "viem";
import { createBankIndexer, getSSOTDb, type BankIndexer, type BankIndexerConfig, type BankIndexerStatus } from "@ssot/ssot/indexer";
import type { SSOTRelease } from "@ssot/ssot/release";

type WorkerInit = {
  chainId: number;
  rpcUrl: string;
  release: SSOTRelease;
  config: BankIndexerConfig;
  dbName: string;
};

export type BankIndexerWorkerStatus = BankIndexerStatus & {
  running: boolean;
  config: BankIndexerConfig;
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
  | { type: "STATUS"; payload: BankIndexerWorkerStatus }
  | { type: "ERROR"; payload: { message: string; stack?: string } };

let init: WorkerInit | undefined;
let indexer: BankIndexer | undefined;
let running = false;
let statusTimer: any | undefined;

function post(msg: FromWorkerMessage) {
  (self as any).postMessage(msg);
}

function computeDerivedStatus(base: BankIndexerStatus, cfg: BankIndexerConfig): BankIndexerWorkerStatus {
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
  if (!init) throw new Error("Bank indexer worker not initialized");
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

  indexer = createBankIndexer({
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
