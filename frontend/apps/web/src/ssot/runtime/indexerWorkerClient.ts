"use client";

import type { SSOTRelease } from "@ssot/ssot/release";
import type { GameHubIndexerConfig } from "@ssot/ssot/indexer";

export type GameHubIndexerWorkerStatus = {
  chainId: number;
  gameHub: `0x${string}`;
  lastSyncedBlock?: number;
  latestBlock?: number;
  lastRunAt?: number;
  lastError?: string;
  running: boolean;
  config: GameHubIndexerConfig;
  safeHeadBlock?: number;
  lagBlocks?: number;
};

type WorkerInit = {
  chainId: number;
  rpcUrl: string;
  release: SSOTRelease;
  config: GameHubIndexerConfig;
  dbName: string;
};

type FromWorkerMessage =
  | { type: "READY" }
  | { type: "STATUS"; payload: GameHubIndexerWorkerStatus }
  | { type: "ERROR"; payload: { message: string; stack?: string } };

type ToWorkerMessage =
  | { type: "INIT"; payload: WorkerInit }
  | { type: "START" }
  | { type: "STOP" }
  | { type: "SYNC_ONCE" }
  | { type: "GET_STATUS" };

export class GameHubIndexerWorkerClient {
  private worker: Worker;
  private ready = false;
  private onStatus?: (s: GameHubIndexerWorkerStatus) => void;
  private onError?: (e: { message: string; stack?: string }) => void;

  constructor(params: {
    init: WorkerInit;
    onStatus: (s: GameHubIndexerWorkerStatus) => void;
    onError: (e: { message: string; stack?: string }) => void;
  }) {
    this.onStatus = params.onStatus;
    this.onError = params.onError;

    // Next/Webpack 5 worker pattern
    this.worker = new Worker(new URL("../../workers/gameHubIndexer.worker.ts", import.meta.url), {
      type: "module"
    });

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
