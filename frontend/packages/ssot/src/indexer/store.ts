import Dexie, { type Table } from "dexie";
import type { Address, Hex } from "viem";

/**
 * Local, replayable facts store.
 *
 * NOTE: All fields are designed to be JSON-serializable.
 * - bigint values are stringified.
 */

export type BetLifecycleState = "placed" | "randomReady" | "finalized" | "refunded" | "voided";

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
 * in the bet's asset; lpRetained + protocolFee + r0 + r1 + r2 = edge.
 */
export interface BetHouseEdgeAllocation {
  usedTurnover: string;
  houseEdgeBps: number;
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
  /** Immutable direct referrer recorded when this bet was accepted. */
  referrerL1?: Address;
  /** Immutable second-level referrer recorded at the same time. */
  referrerL2?: Address;
  stake?: string;
  payout?: string;
  payoutGross?: string;
  refundAmount?: string;
  requestId?: string;
  randomHash?: Hex;
  terminalTxHash?: Hex;
  finalizedTxHash?: Hex;
  refundedTxHash?: Hex;
  /** GameHub BetVoided: the stake became a player payable and nothing was paid out (ADR-0037 §7.4). */
  voidedTxHash?: Hex;
  /** Who executed voidBet. */
  voidCaller?: Address;
  /** First 32 bytes of the failed settlement attempt's revert data inside voidBet. */
  voidSettlementErrorPrefix?: Hex;
  placedBlock?: number;
  placedAt?: number;
  refundDeadline?: number;
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

export class SSOTDb extends Dexie {
  gameHubEvents!: Table<GameHubEventRow, string>;
  bets!: Table<BetRow, string>;
  cursors!: Table<CursorRow, string>;
  txJournal!: Table<TxJournalRow, string>;

  constructor(name = "arbigamefi_liquidity") {
    super(name);
    this.version(1).stores({
      gameHubEvents: "id, chainId, gameHub, blockNumber, txHash, logIndex, eventName",
      bets: "id, chainId, betId, state, updatedBlock",
      cursors: "id, chainId, source",
      txJournal: "id, chainId, txHash, createdAt, ok, action"
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
  const key = name ?? "arbigamefi_liquidity";
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
  return getSSOTDb(
    `arbigamefi_liquidity_${release.chainId}_${release.releaseDigest.toLowerCase()}`
  );
}
