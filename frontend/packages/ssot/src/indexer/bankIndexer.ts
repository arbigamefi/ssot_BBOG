import type { PublicClient, Address, Abi, AbiEvent, Hex } from "viem";
import { getAddress } from "viem";
import type { SSOTRelease } from "../release/schema";
import { getContractAbis } from "../abis/index.mjs";
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
  "XPAccruedClaimed",
  "Deposit",
  "Withdraw",
  "RedeemRequest",
  "RedeemRequestCancelled",
  "RedeemBatchOpened",
  "RedeemBatchRetired",
  "RedeemBatchPriced",
  "RedeemBatchActivated",
  "RecoveryUpdated",
  "RecoverySynced",
  "RecoveryClaimed",
  "ProtocolCapitalAccrued",
  "RedeemClaimable",
  "RedeemRemainderReleased",
  "PlayerPayableCreated",
  "PlayerPayablePaid"
] as const;

type BankEventName = (typeof BANK_EVENTS)[number];

const XP_EVENTS = new Set<string>([
  "XPAwarded",
  "XPLockedUnlocked",
  "XPHoldbackReleased",
  "XPAccruedClaimed"
]);

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

  const banks = Array.from(new Set(release.pools.map((pool) => getAddress(pool.bank) as Address)));

  const status: BankIndexerStatus = { chainId: release.chainId, banks };
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<void> | undefined;
  const bankSet = new Set(banks.map((bank) => bank.toLowerCase()));
  if (!Number.isSafeInteger(config.batchSize) || config.batchSize <= 0)
    throw new Error("Bank indexer batchSize must be positive");

  // Scope the checkpoint to the deployment and its event source.
  const releaseStartBlock = Number(release.meta?.blockNumber ?? 0);
  const cursorId = `${release.chainId}:bank-events:${releaseStartBlock}:${[...bankSet].sort().join(",")}`;

  function syncOnce(): Promise<void> {
    if (!inFlight)
      inFlight = runSync().finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  }

  async function runSync(): Promise<void> {
    try {
      status.lastRunAt = Date.now();
      status.lastError = undefined;

      const latestBlockBn = await publicClient.getBlockNumber();
      const latestBlock = Number(latestBlockBn);
      status.latestBlock = latestBlock;

      const targetBlock = Math.max(0, latestBlock - config.confirmations);

      const cursor = await db.cursors.get(cursorId);

      let fromBlock = cursor ? cursor.lastProcessedBlock + 1 : releaseStartBlock;
      if (cursor && config.rewindBlocks > 0) {
        fromBlock = Math.max(
          releaseStartBlock,
          cursor.lastProcessedBlock - config.rewindBlocks + 1
        );
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
    } catch (e: any) {
      status.lastError = e?.message ? String(e.message) : String(e);
    }
  }

  async function syncRange(fromBlock: number, toBlock: number): Promise<void> {
    const { BankAbi } = getContractAbis();
    const bankAbi = BankAbi as Abi;
    const events = BANK_EVENTS.map((name) => getEventAbi(bankAbi, name));
    const logs =
      banks.length === 0
        ? []
        : await publicClient.getLogs({
            address: banks,
            events,
            strict: true,
            fromBlock: BigInt(fromBlock),
            toBlock: BigInt(toBlock)
          });
    const logsAll: BankEventNormalized[] = [];
    for (const log of logs as Array<{
      address: Address;
      eventName: string;
      blockNumber: bigint | null;
      logIndex: number | null;
      transactionHash: Hex | null;
      args?: Record<string, unknown>;
    }>) {
      if (
        !bankSet.has(log.address.toLowerCase()) ||
        !BANK_EVENTS.includes(log.eventName as BankEventName)
      )
        continue;
      if (log.blockNumber == null || log.logIndex == null || log.transactionHash == null)
        throw new Error("Bank log is missing its mined identity");
      logsAll.push({
        chainId: release.chainId,
        bank: getAddress(log.address),
        blockNumber: Number(log.blockNumber),
        logIndex: log.logIndex,
        txHash: log.transactionHash,
        eventName: log.eventName as BankEventName,
        args: log.args ?? {}
      });
    }

    // deterministic order
    logsAll.sort((a, b) => {
      const d = a.blockNumber - b.blockNumber;
      if (d !== 0) return d;
      const li = a.logIndex - b.logIndex;
      if (li !== 0) return li;
      return a.txHash > b.txHash ? 1 : a.txHash < b.txHash ? -1 : 0;
    });

    await db.transaction("rw", db.bankEvents, db.xpSnapshots, db.cursors, async () => {
      // Replacing the fetched range also removes orphaned events when a reorg returns no replacement logs.
      const bankRows = await db.bankEvents
        .where("blockNumber")
        .between(fromBlock, toBlock, true, true)
        .filter((row) => row.chainId === release.chainId && bankSet.has(row.bank.toLowerCase()))
        .toArray();
      const bankKeys = bankRows.map((row) => row.id);
      const xpKeys = await db.xpSnapshots
        .where("blockNumber")
        .between(fromBlock, toBlock, true, true)
        .filter((row) => row.chainId === release.chainId && bankSet.has(row.bank.toLowerCase()))
        .primaryKeys();
      await db.bankEvents.bulkDelete(bankKeys);
      await db.xpSnapshots.bulkDelete(xpKeys);
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
            bank: ev.bank,
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
      await db.cursors.put({
        id: cursorId,
        chainId: release.chainId,
        source: banks[0]!,
        lastProcessedBlock: toBlock,
        updatedAt: Date.now()
      });
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

function toBigintString(value: unknown): string {
  if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string") {
    throw new Error("Expected an integer event value");
  }
  return BigInt(value).toString();
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
      return args.accrued;
    case "XPLockedUnlocked":
    case "XPHoldbackReleased":
    case "XPAccruedClaimed":
      return args.amount ?? 0n;
    default:
      return 0n;
  }
}
