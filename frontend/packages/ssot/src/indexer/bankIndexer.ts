import type { PublicClient, Address, Abi, AbiEvent, Hex } from "viem";
import { getAddress } from "viem";
import type { SSOTRelease } from "../release/schema";
import { getReleaseAbis } from "../abis/release/resolver";
import type { SSOTDb, BankXPEventName } from "./store";

export interface BankIndexerConfig {
  confirmations: number;
  pollIntervalMs: number;
  batchSize: number;
  rewindBlocks: number;
}

export interface BankIndexerStatus {
  chainId: number;
  banks: Address[];
  lastSyncedBlock?: number;
  latestBlock?: number;
  lastRunAt?: number;
  lastError?: string;
}

export interface BankIndexer {
  start(): void;
  stop(): void;
  syncOnce(): Promise<void>;
  getStatus(): BankIndexerStatus;
}

const DEFAULT_CONFIG: BankIndexerConfig = {
  confirmations: 12,
  pollIntervalMs: 10_000,
  batchSize: 2_000,
  rewindBlocks: 24
};

/** Bank events worth indexing for XP history, bet settlements, and claims. */
const BANK_EVENTS = [
  "BetSettled",
  "XPAwarded",
  "XPLockedUnlocked",
  "XPHoldbackReleased",
  "XPAccruedClaimed"
] as const;

type BankEventName = (typeof BANK_EVENTS)[number];

const XP_EVENTS = new Set<string>(["XPAwarded", "XPLockedUnlocked", "XPHoldbackReleased", "XPAccruedClaimed"]);

interface BankEventNormalized {
  chainId: number;
  bank: Address;
  blockNumber: number;
  logIndex: number;
  txHash: Hex;
  eventName: BankEventName;
  args: Record<string, unknown>;
}

export function createBankIndexer(params: {
  release: SSOTRelease;
  publicClient: PublicClient;
  db: SSOTDb;
  config?: Partial<BankIndexerConfig>;
}): BankIndexer {
  const { release, publicClient, db } = params;
  const config: BankIndexerConfig = { ...DEFAULT_CONFIG, ...(params.config ?? {}) };

  // Collect all bank addresses from the release assets
  const banks = release.assets.map((a) => getAddress(a.bank) as Address);

  const status: BankIndexerStatus = { chainId: release.chainId, banks };
  let timer: any | undefined;

  // Cursor id uses first bank address as key (all banks share one cursor)
  const cursorId = `${release.chainId}:bank`;

  async function syncOnce(): Promise<void> {
    try {
      status.lastRunAt = Date.now();
      status.lastError = undefined;

      const latestBlockBn = await publicClient.getBlockNumber();
      const latestBlock = Number(latestBlockBn);
      status.latestBlock = latestBlock;

      const targetBlock = Math.max(0, latestBlock - config.confirmations);

      const cursor = await db.cursors.get(cursorId);
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

      // Cursor update INSIDE transaction (fixes atomicity bug from hubIndexer)
      // Actually we update cursor after all batches complete. For atomicity,
      // we use a separate transaction for the cursor.
      await db.transaction("rw", db.cursors, async () => {
        await db.cursors.put({
          id: cursorId,
          chainId: release.chainId,
          hub: banks[0]!, // reuse CursorRow's hub field for bank address
          lastProcessedBlock: targetBlock,
          updatedAt: Date.now()
        });
      });
    } catch (e: any) {
      status.lastError = e?.message ? String(e.message) : String(e);
    }
  }

  async function syncRange(fromBlock: number, toBlock: number): Promise<void> {
    const { BankAbi } = getReleaseAbis(release.chainId);
    const bankAbi = BankAbi as Abi;

    const logsAll: BankEventNormalized[] = [];

    // Fetch logs for all bank addresses × all event types
    for (const bankAddr of banks) {
      for (const eventName of BANK_EVENTS) {
        const eventAbi = getEventAbi(bankAbi, eventName);
        const logs = await publicClient.getLogs({
          address: bankAddr,
          event: eventAbi,
          fromBlock: BigInt(fromBlock),
          toBlock: BigInt(toBlock)
        });

        for (const log of logs as any[]) {
          const logIndex = Number(log.logIndex ?? 0);
          logsAll.push({
            chainId: release.chainId,
            bank: bankAddr,
            blockNumber: Number(log.blockNumber),
            logIndex,
            txHash: log.transactionHash,
            eventName,
            args: log.args ?? {}
          });
        }
      }
    }

    // deterministic order
    logsAll.sort((a, b) => {
      const d = a.blockNumber - b.blockNumber;
      if (d !== 0) return d;
      const li = a.logIndex - b.logIndex;
      if (li !== 0) return li;
      return a.txHash > b.txHash ? 1 : a.txHash < b.txHash ? -1 : 0;
    });

    if (logsAll.length === 0) return;

    await db.transaction("rw", db.bankEvents, db.xpSnapshots, async () => {
      for (const ev of logsAll) {
        const rowId = `${ev.chainId}:${ev.bank}:${ev.txHash}:${ev.logIndex}`;
        const argsJson = safeJson(ev.args);

        // Store raw event
        await db.bankEvents.put({
          id: rowId,
          chainId: ev.chainId,
          bank: ev.bank,
          blockNumber: ev.blockNumber,
          txHash: ev.txHash,
          logIndex: ev.logIndex,
          eventName: ev.eventName,
          argsJson,
          createdAt: Date.now()
        });

        // Derive XP snapshots for XP-related events
        if (XP_EVENTS.has(ev.eventName)) {
          const payee = (ev.args.payee as Address) ?? ("0x0" as Address);
          const amount = extractPrimaryAmount(ev.eventName as BankXPEventName, ev.args);
          const snapId = `${ev.chainId}:${payee}:${ev.blockNumber}:${ev.logIndex}`;

          await db.xpSnapshots.put({
            id: snapId,
            chainId: ev.chainId,
            payee,
            eventType: ev.eventName as BankXPEventName,
            blockNumber: ev.blockNumber,
            logIndex: ev.logIndex,
            txHash: ev.txHash,
            amount: toBigintString(amount),
            argsJson,
            createdAt: Date.now()
          });
        }
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

  function getStatus(): BankIndexerStatus {
    return { ...status };
  }

  return { start, stop, syncOnce, getStatus };
}

// ——— Helpers ———

function getEventAbi(abi: Abi, eventName: string): AbiEvent {
  const item = abi.find((x: any) => x?.type === "event" && x?.name === eventName);
  if (!item) throw new Error(`Bank ABI missing event ${eventName}`);
  return item as any;
}

function safeJson(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

function toBigintString(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return BigInt(v).toString();
  if (typeof v === "string") {
    if (v.startsWith("0x")) {
      try { return BigInt(v).toString(); } catch { /* fallthrough */ }
    }
    if (/^\d+$/.test(v)) return v;
  }
  return String(v ?? "0");
}

/**
 * Extract the "primary" amount from an XP event's args.
 *
 * - XPAwarded → accrued (total XP awarded before lock/holdback split)
 * - XPLockedUnlocked → amount
 * - XPHoldbackReleased → amount
 * - XPAccruedClaimed → amount
 */
function extractPrimaryAmount(eventType: BankXPEventName, args: Record<string, unknown>): unknown {
  switch (eventType) {
    case "XPAwarded":
      return args.accrued ?? args.amount ?? 0n;
    case "XPLockedUnlocked":
    case "XPHoldbackReleased":
    case "XPAccruedClaimed":
      return args.amount ?? 0n;
    default:
      return 0n;
  }
}
