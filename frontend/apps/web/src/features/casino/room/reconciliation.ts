import type { BetRow, GameHubEventRow, SSOTDb } from "@ssot/ssot/indexer";

export type IndexedBetSummary = Pick<BetRow, "betId" | "state" | "lastTxHash">;

export function findIndexedBetById(
  bets: readonly IndexedBetSummary[],
  betId: bigint | string | number | undefined
) {
  if (betId === undefined) return undefined;
  const expected = betId.toString();
  return bets.find((bet) => bet.betId.toString() === expected);
}

export function isTerminalIndexedBet(bet: IndexedBetSummary | undefined) {
  return bet?.state === "finalized" || bet?.state === "refunded";
}

export function parseFinalizedPayoutWin(argsJson: string | undefined) {
  if (!argsJson) return false;
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>;
    const payout = BigInt(String(args.payout ?? args.totalPayout ?? "0"));
    const stake = BigInt(String(args.stake ?? "0"));
    return payout > stake;
  } catch {
    return false;
  }
}

export async function readFinalizedPayoutWin({
  db,
  txHash
}: {
  db: Pick<SSOTDb, "gameHubEvents"> | undefined;
  txHash: string | undefined;
}) {
  if (!db || !txHash) return false;

  try {
    const events = await db.gameHubEvents
      .where("txHash")
      .equals(txHash as GameHubEventRow["txHash"])
      .filter((event) => event.eventName === "BetFinalized")
      .toArray();
    return parseFinalizedPayoutWin(events[0]?.argsJson);
  } catch {
    return false;
  }
}
