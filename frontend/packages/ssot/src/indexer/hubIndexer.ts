import type { PublicClient, Address, Abi, AbiEvent } from "viem";
import { getAddress } from "viem";
import type { SSOTRelease } from "../release/schema";
import { getReleaseAbis } from "../abis/release/resolver";
import type { SSOTDb } from "./store";
import type { HubEventName, HubEventNormalized } from "./reduce";
import { applyHubEventToBet } from "./reduce";

export interface HubIndexerConfig {
  confirmations: number;
  pollIntervalMs: number;
  batchSize: number;
  rewindBlocks: number;
}

export interface HubIndexerStatus {
  chainId: number;
  hub: Address;
  lastSyncedBlock?: number;
  latestBlock?: number;
  lastRunAt?: number;
  lastError?: string;
}

export interface HubIndexer {
  start(): void;
  stop(): void;
  syncOnce(): Promise<void>;
  getStatus(): HubIndexerStatus;
}

const DEFAULT_CONFIG: HubIndexerConfig = {
  confirmations: 12,
  pollIntervalMs: 10_000,
  batchSize: 2_000,
  rewindBlocks: 24
};

const HUB_EVENTS: HubEventName[] = ["BetPlaced", "BetRandomReady", "BetFinalized", "BetRefunded"];

export function createHubIndexer(params: {
  release: SSOTRelease;
  publicClient: PublicClient;
  db: SSOTDb;
  config?: Partial<HubIndexerConfig>;
}): HubIndexer {
  const { release, publicClient, db } = params;
  const config: HubIndexerConfig = { ...DEFAULT_CONFIG, ...(params.config ?? {}) };
  const hub = getAddress(release.contracts.hub) as Address;

  const status: HubIndexerStatus = { chainId: release.chainId, hub };
  let timer: any | undefined;

  async function syncOnce(): Promise<void> {
    try {
      status.lastRunAt = Date.now();
      status.lastError = undefined;

      const latestBlockBn = await publicClient.getBlockNumber();
      const latestBlock = Number(latestBlockBn);
      status.latestBlock = latestBlock;

      const targetBlock = Math.max(0, latestBlock - config.confirmations);

      const cursorId = `${release.chainId}:${hub}`;
      const cursor = await db.cursors.get(cursorId);

      // Prefer release meta.blockNumber as the starting point for a fresh DB.
      const releaseStartBlock = Number(release.meta?.blockNumber ?? 0);

      let fromBlock = cursor ? cursor.lastProcessedBlock + 1 : releaseStartBlock;
      if (cursor && config.rewindBlocks > 0) {
        fromBlock = Math.max(releaseStartBlock, cursor.lastProcessedBlock - config.rewindBlocks + 1);
      }

      if (fromBlock > targetBlock) {
        status.lastSyncedBlock = cursor?.lastProcessedBlock ?? releaseStartBlock;
        return;
      }

      // Batch to avoid provider limits
      for (let start = fromBlock; start <= targetBlock; start += config.batchSize) {
        const end = Math.min(targetBlock, start + config.batchSize - 1);
        await syncRange(start, end);
        status.lastSyncedBlock = end;
      }

      // Cursor update in its own transaction for atomicity
      await db.transaction("rw", db.cursors, async () => {
        await db.cursors.put({
          id: cursorId,
          chainId: release.chainId,
          hub,
          lastProcessedBlock: targetBlock,
          updatedAt: Date.now()
        });
      });
    } catch (e: any) {
      status.lastError = e?.message ? String(e.message) : String(e);
    }
  }

  async function syncRange(fromBlock: number, toBlock: number): Promise<void> {
    const { HubAbi } = getReleaseAbis(release.chainId);
    const hubAbi = HubAbi as Abi;

    const logsAll: HubEventNormalized[] = [];

    for (const eventName of HUB_EVENTS) {
      const eventAbi = getEventAbi(hubAbi, eventName);
      const logs = await publicClient.getLogs({
        address: hub,
        event: eventAbi,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock)
      });

      for (const log of logs as any[]) {
        const logIndex = Number(log.logIndex ?? 0);
        logsAll.push({
          chainId: release.chainId,
          hub,
          blockNumber: Number(log.blockNumber),
          logIndex,
          txHash: log.transactionHash,
          eventName,
          args: log.args ?? {}
        });
      }
    }

    // deterministic order
    logsAll.sort((a, b) => {
      const d = a.blockNumber - b.blockNumber;
      if (d !== 0) return d;
      const li = (a.logIndex ?? 0) - (b.logIndex ?? 0);
      if (li !== 0) return li;
      return a.txHash > b.txHash ? 1 : a.txHash < b.txHash ? -1 : 0;
    });

    if (logsAll.length === 0) return;

    await db.transaction("rw", db.hubEvents, db.bets, async () => {
      for (const ev of logsAll) {
        const rowId = `${ev.chainId}:${ev.txHash}:${ev.logIndex ?? 0}`;
        const argsJson = safeJson(ev.args);
        await db.hubEvents.put({
          id: rowId,
          chainId: ev.chainId,
          hub,
          blockNumber: ev.blockNumber,
          txHash: ev.txHash,
          logIndex: ev.logIndex ?? 0,
          eventName: ev.eventName,
          argsJson,
          createdAt: Date.now()
        });

        const betKey = `${ev.chainId}:${extractBetIdString(ev.args)}`;
        const prev = await db.bets.get(betKey);
        const next = applyHubEventToBet(prev, ev);
        await db.bets.put(next);
      }
    });
  }

  function start(): void {
    if (timer) return;
    timer = setInterval(() => {
      void syncOnce();
    }, config.pollIntervalMs);
    void syncOnce();
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  function getStatus(): HubIndexerStatus {
    return { ...status };
  }

  return { start, stop, syncOnce, getStatus };
}

function getEventAbi(abi: Abi, eventName: string): AbiEvent {
  const item = abi.find((x: any) => x?.type === "event" && x?.name === eventName);
  if (!item) throw new Error(`Hub ABI missing event ${eventName}`);
  return item as any;
}

function safeJson(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

function extractBetIdString(args: Record<string, unknown>): string {
  const raw = (args as any).betId ?? (args as any).id ?? "0";
  if (typeof raw === "bigint") return raw.toString();
  if (typeof raw === "number") return BigInt(raw).toString();
  if (typeof raw === "string") {
    if (raw.startsWith("0x")) {
      try {
        return BigInt(raw).toString();
      } catch {
        return "0";
      }
    }
    return raw;
  }
  return String(raw);
}
