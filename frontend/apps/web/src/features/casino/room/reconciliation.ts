import type { BetRow, GameHubEventRow, SSOTDb } from "@ssot/ssot/indexer";

export type IndexedBetSummary = Pick<BetRow, "betId" | "state" | "lastTxHash">;

export type SettlementProof = {
  txHash?: string;
  payoutGross?: bigint;
  payoutNet?: bigint;
  refundAmount?: bigint;
  feeOnPayout?: bigint;
  protocolFeeAccrual?: bigint;
};

export type RefundProof = {
  txHash?: string;
  refundAmount?: bigint;
};

export type TerminalProof =
  | { kind: "settled"; settlement: SettlementProof }
  | { kind: "refunded"; refund: RefundProof };

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

export function parseFinalizedPayout(argsJson: string | undefined): SettlementProof | null {
  const args = parseArgs(argsJson);
  if (!args) return null;
  return {
    payoutGross: readBigintArg(args.payoutGross),
    payoutNet: readBigintArg(args.payoutNet),
    refundAmount: readBigintArg(args.refundAmount),
    feeOnPayout: readBigintArg(args.feeOnPayout),
    protocolFeeAccrual: readBigintArg(args.protocolFeeAccrual)
  };
}

export function parseRefund(argsJson: string | undefined): RefundProof | null {
  const args = parseArgs(argsJson);
  if (!args) return null;
  return {
    refundAmount: readBigintArg(args.refundAmount)
  };
}

export function matchesBetId(argsJson: string | undefined, expectedBetId: string) {
  const args = parseArgs(argsJson);
  if (!args) return false;
  const raw = args.positionId ?? args.betId ?? args.id;
  return raw != null && String(raw) === expectedBetId;
}

export function extractTerminalProofFromRows(
  rows: readonly Pick<GameHubEventRow, "eventName" | "argsJson" | "txHash">[],
  betId: bigint | string | number
): TerminalProof | null {
  const expected = betId.toString();
  const terminal = [...rows]
    .reverse()
    .find(
      (row) =>
        (row.eventName === "BetFinalized" || row.eventName === "BetRefunded") &&
        matchesBetId(row.argsJson, expected)
    );
  if (!terminal) return null;

  if (terminal.eventName === "BetFinalized") {
    const settlement = parseFinalizedPayout(terminal.argsJson);
    return settlement
      ? { kind: "settled", settlement: { ...settlement, txHash: terminal.txHash } }
      : null;
  }

  const refund = parseRefund(terminal.argsJson);
  return refund ? { kind: "refunded", refund: { ...refund, txHash: terminal.txHash } } : null;
}

export async function readTerminalProof({
  db,
  betId,
  txHash
}: {
  db: Pick<SSOTDb, "gameHubEvents"> | undefined;
  betId: bigint | string | number | undefined;
  txHash: string | undefined;
}) {
  if (!db || betId === undefined) return null;

  try {
    const rows = txHash
      ? await db.gameHubEvents
          .where("txHash")
          .equals(txHash as GameHubEventRow["txHash"])
          .toArray()
      : await db.gameHubEvents.where("eventName").anyOf("BetFinalized", "BetRefunded").toArray();
    return extractTerminalProofFromRows(rows, betId);
  } catch {
    return null;
  }
}

function parseArgs(argsJson: string | undefined): Record<string, unknown> | null {
  if (!argsJson) return null;
  try {
    return JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readBigintArg(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    if (!value) return undefined;
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}
