import Dexie, { type Table } from "dexie";
import type { Address, Hex } from "viem";

/**
 * Local, replayable facts store.
 *
 * NOTE: All fields are designed to be JSON-serializable.
 * - bigint values are stringified.
 */

export type BetLifecycleState = "placed" | "randomReady" | "finalized" | "refunded";

export interface GameHubEventRow {
  id: string; // `${chainId}:${txHash}:${logIndex}`
  chainId: number;
  gameHub: Address;
  blockNumber: number;
  txHash: Hex;
  logIndex: number;
  eventName: string;
  argsJson: string; // JSON.stringify(args)
  createdAt: number;
}

/**
 * How a settled bet's house edge was allocated (v1.6 HouseEdgeAllocated). Amounts are bigint strings
 * in the bet's asset; lpRetained + protocolFee + r0 + r1 + r2 + markup = edge.
 */
export interface BetHouseEdgeAllocation {
  usedTurnover: string;
  effectiveHouseEdgeBps: number;
  edge: string;
  operatorShare: string;
  lpRetained: string;
  protocolFee: string;
  /** Player rakeback (L0). */
  r0: string;
  /** First-level referrer (L1). */
  r1: string;
  /** Second-level referrer (L2). */
  r2: string;
  /** Affiliate markup share. */
  markup: string;
}

export interface BetRow {
  id: string; // `${chainId}:${betId}`, unique within one release-scoped DB
  chainId: number;
  /** The issuing deployment; bet IDs are local to one GameHub. */
  gameHub: Address;
  betId: string; // bigint string
  state: BetLifecycleState;
  gameId?: Hex;
  asset?: Address;
  player?: Address;
  pricingAffiliate?: Address;
  stake?: string;
  payout?: string;
  payoutGross?: string;
  refundAmount?: string;
  requestId?: string;
  randomHash?: Hex;
  terminalTxHash?: Hex;
  finalizedTxHash?: Hex;
  refundedTxHash?: Hex;
  placedBlock?: number;
  placedAt?: number;
  updatedBlock: number;
  lastTxHash: Hex;
  lastEventName: string;
  updatedAt: number;
  /** From the server's bet index; absent for refunds and unsettled bets. */
  houseEdge?: BetHouseEdgeAllocation;
}

export interface CursorRow {
  id: string; // `${chainId}:${source}`
  chainId: number;
  source: Address;
  lastProcessedBlock: number;
  updatedAt: number;
}

export interface TxJournalRow {
  id: string; // `${chainId}:${txHash}`
  chainId: number;
  txHash: Hex;
  releaseDigest: string;
  action: string;
  status: "submitted" | "mined" | "failed" | "timeout";
  ok: boolean;
  createdAt: number;
  minedAt?: number;
  blockNumber?: number;
  errorCode?: string;
}

export type BankXPEventName =
  | "XPAwarded"
  | "XPLockedUnlocked"
  | "XPHoldbackReleased"
  | "XPAccruedClaimed";

export interface BankEventRow {
  id: string; // `${chainId}:${bank}:${txHash}:${logIndex}`
  chainId: number;
  bank: Address;
  blockNumber: number;
  txHash: Hex;
  logIndex: number;
  eventName: string;
  argsJson: string; // JSON.stringify(args) with bigint → string
  createdAt: number;
}

export interface XPSnapshotRow {
  bank: Address;
  id: string; // `${chainId}:${payee}:${blockNumber}:${logIndex}`
  chainId: number;
  payee: Address;
  eventType: BankXPEventName;
  blockNumber: number;
  logIndex: number;
  txHash: Hex;
  /** Primary amount for this event (stringified bigint). */
  amount: string;
  argsJson: string;
  createdAt: number;
}

export class SSOTDb extends Dexie {
  gameHubEvents!: Table<GameHubEventRow, string>;
  bets!: Table<BetRow, string>;
  cursors!: Table<CursorRow, string>;
  txJournal!: Table<TxJournalRow, string>;
  bankEvents!: Table<BankEventRow, string>;
  xpSnapshots!: Table<XPSnapshotRow, string>;

  constructor(name = "ssot_frontend") {
    super(name);
    this.version(1).stores({
      gameHubEvents: "id, chainId, gameHub, blockNumber, txHash, logIndex, eventName",
      bets: "id, chainId, betId, state, updatedBlock",
      cursors: "id, chainId, source",
      txJournal: "id, chainId, txHash, createdAt, ok, action",
      bankEvents: "id, chainId, bank, blockNumber, txHash, logIndex, eventName",
      xpSnapshots: "id, [chainId+payee+blockNumber], payee, eventType, blockNumber"
    });
  }
}

const _dbs = new Map<string, SSOTDb>();

/**
 * Returns a process-wide singleton DB.
 *
 * IMPORTANT: Only call this in the browser (client components).
 */
export function getSSOTDb(name?: string): SSOTDb {
  const key = name ?? "ssot_frontend";
  const existing = _dbs.get(key);
  if (existing) return existing;
  const db = new SSOTDb(key);
  _dbs.set(key, db);
  return db;
}

/** Keep facts and journals scoped to the current deployment identity. */
export function getReleaseScopedSSOTDb(release: {
  chainId: number;
  releaseDigest: string;
}): SSOTDb {
  return getSSOTDb(`ssot_frontend_${release.chainId}_${release.releaseDigest.toLowerCase()}`);
}
