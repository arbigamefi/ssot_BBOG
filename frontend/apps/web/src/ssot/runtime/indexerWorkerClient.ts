"use client";

import type { SSOTRelease } from "@ssot/ssot/release";
import type { HubIndexerConfig } from "@ssot/ssot/indexer";

export type HubIndexerWorkerStatus = {
  chainId: number;
  hub: `0x${string}`;
  lastSyncedBlock?: number;
  latestBlock?: number;
  lastRunAt?: number;
  lastError?: string;
  running: boolean;
  config: HubIndexerConfig;
  safeHeadBlock?: number;
  lagBlocks?: number;
};

type WorkerInit = {
  chainId: number;
  rpcUrl: string;
  release: SSOTRelease;
  config: HubIndexerConfig;
  dbName: string;
};

type FromWorkerMessage =
  | { type: "READY" }
  | { type: "STATUS"; payload: HubIndexerWorkerStatus }
  | { type: "ERROR"; payload: { message: string; stack?: string } };

type ToWorkerMessage =
  | { type: "INIT"; payload: WorkerInit }
  | { type: "START" }
  | { type: "STOP" }
  | { type: "SYNC_ONCE" }
  | { type: "GET_STATUS" };

export class HubIndexerWorkerClient {
  private worker: Worker;
  private ready = false;
  private onStatus?: (s: HubIndexerWorkerStatus) => void;
  private onError?: (e: { message: string; stack?: string }) => void;

  constructor(params: {
    init: WorkerInit;
    onStatus: (s: HubIndexerWorkerStatus) => void;
    onError: (e: { message: string; stack?: string }) => void;
  }) {
    this.onStatus = params.onStatus;
    this.onError = params.onError;

    // Next/Webpack 5 worker pattern
    this.worker = new Worker(new URL("../../workers/hubIndexer.worker.ts", import.meta.url), { type: "module" });

    this.worker.onmessage = (ev: MessageEvent<FromWorkerMessage>) => {
      const msg = ev.data;
      if (msg.type === "READY") {
        this.ready = true;
        return;
      }
      if (msg.type === "STATUS") {
        this.onStatus?.(msg.payload);
        return;
      }
      if (msg.type === "ERROR") {
        this.onError?.(msg.payload);
      }
    };

    this.post({ type: "INIT", payload: params.init });
  }

  private post(msg: ToWorkerMessage) {
    this.worker.postMessage(msg);
  }

  start() {
    this.post({ type: "START" });
  }

  stop() {
    this.post({ type: "STOP" });
  }

  syncOnce() {
    this.post({ type: "SYNC_ONCE" });
  }

  refreshStatus() {
    this.post({ type: "GET_STATUS" });
  }

  terminate() {
    try {
      this.stop();
    } catch {
      // ignore
    }
    this.worker.terminate();
  }
}
