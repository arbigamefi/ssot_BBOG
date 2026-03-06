import type { Hex } from "viem";
import type { TxJournalEntry, JournalSink } from "../sdk/txPipeline";
import type { SSOTDb, TxJournalRow } from "./store";

/**
 * Dexie-backed TxJournal sink.
 *
 * Notes:
 * - Journal is local-only and is meant for user support/incident review.
 * - We store a single row per txHash (upsert), with the latest status.
 */
export function createDexieJournalSink(db: SSOTDb): JournalSink {
  return (entry: TxJournalEntry) => {
    // fire-and-forget: journaling must never block transactions
    void db.txJournal.put(toRow(entry));
  };
}

function toRow(entry: TxJournalEntry): TxJournalRow {
  const txHash = entry.txHash as Hex;
  return {
    id: `${entry.chainId}:${txHash}`,
    chainId: entry.chainId,
    txHash,
    releaseDigest: entry.releaseDigest,
    action: entry.action,
    status: entry.status,
    ok: entry.ok,
    createdAt: entry.createdAt,
    minedAt: entry.minedAt,
    blockNumber: entry.blockNumber,
    errorCode: entry.errorCode
  };
}
