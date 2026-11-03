import { getCasinoCashReturned } from "@ssot/bet-index/financials";
import type { SSOTRelease } from "@ssot/ssot/release";

import type { BetReceiptResponse } from "../betting/recent-bets";
import { exactAmount, receiptFromRow, type Receipt } from "./receipt";

// What the public receipt page shows for one bet (docs/design/04-page-blueprints.md §5), as plain
// data the server hands the page. Every state of 03-information-architecture.md §5 is a kind here.

/** The bet's game and asset, from the release that issued it. */
export type ReceiptPageBet = {
  chainId: number;
  betId: string;
  /** Lowercase; the GameHub that issued the bet. */
  gameHub?: string;
  gameSlug?: string;
  /** The release's own name for the game, used when the slug has no translation. */
  gameLabel?: string;
  symbol: string;
  decimals: number;
};

/** HouseEdgeAllocated: the allocation of the turnover, exact, in the bet's asset. */
export type ReceiptAllocation = {
  rateBps: number;
  turnover: string;
  edge: string;
  liquidity: string;
  rakeback?: string;
  referrers?: string;
  protocol: string;
};

export type ReceiptPageView =
  /** The index has no such bet: a wrong link, or a bet placed seconds ago. */
  | { kind: "missing"; bet: ReceiptPageBet }
  /** The bet index could not be read; the receipt is still on chain. */
  | { kind: "degraded"; bet: ReceiptPageBet }
  /** Placed, waiting for randomness or for its settlement. */
  | {
      kind: "pending";
      bet: ReceiptPageBet;
      state: "placed" | "randomReady";
      stake?: string;
      requestId?: string;
      placedBlock?: number;
      /** Milliseconds: when the stake can be refunded if no result arrives. */
      refundDeadline?: number;
    }
  /** Finished on chain, but the index does not yet hold every amount the receipt prints. */
  | { kind: "indexing"; bet: ReceiptPageBet; state: "finalized" | "refunded" | "voided" }
  | {
      kind: "printed";
      bet: ReceiptPageBet;
      receipt: Receipt;
      /** The bet's house edge rate, else the release's. */
      houseEdgeBps?: number;
      /** Read from the terminal transaction, when it was. */
      payment?: "transferred" | "payable";
      /** The pool a claimable or held amount is claimed from, when the asset has exactly one. */
      poolId?: number;
      player?: string;
      referrerL1?: string;
      referrerL2?: string;
      asset?: string;
      placedBlock?: number;
      lastEventName: string;
      /** Milliseconds. */
      indexedAt: number;
      source: "index" | "chain";
      allocation?: ReceiptAllocation;
    };

function toBigInt(value: string) {
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function allocationOf(
  allocation: NonNullable<NonNullable<BetReceiptResponse["row"]>["houseEdge"]>,
  decimals: number
): ReceiptAllocation | undefined {
  const values = {
    turnover: toBigInt(allocation.usedTurnover),
    edge: toBigInt(allocation.edge),
    liquidity: toBigInt(allocation.lpRetained),
    protocol: toBigInt(allocation.protocolFee),
    r0: toBigInt(allocation.r0),
    r1: toBigInt(allocation.r1),
    r2: toBigInt(allocation.r2)
  };
  const { turnover, edge, liquidity, protocol, r0, r1, r2 } = values;
  if (
    turnover == null ||
    edge == null ||
    liquidity == null ||
    protocol == null ||
    r0 == null ||
    r1 == null ||
    r2 == null
  )
    return undefined;
  const exact = (value: bigint) => exactAmount(value, decimals);
  return {
    rateBps: allocation.houseEdgeBps,
    turnover: exact(turnover),
    edge: exact(edge),
    liquidity: exact(liquidity),
    ...(r0 > 0n ? { rakeback: exact(r0) } : {}),
    ...(r1 + r2 > 0n ? { referrers: exact(r1 + r2) } : {}),
    protocol: exact(protocol)
  };
}

/**
 * The page for one bet. `response` is null when the bet index could not be read at all; a
 * response without a row is a missing bet, unless no index was there to ask.
 */
export function buildReceiptPageView({
  chainId,
  betId,
  response,
  release
}: {
  chainId: number;
  betId: string;
  response: BetReceiptResponse | null;
  release?: SSOTRelease;
}): ReceiptPageView {
  const row = response?.row;
  const game = row?.gameId
    ? release?.gamesMeta.find((item) => item.gameId === row.gameId?.toLowerCase())
    : undefined;
  const asset = row?.asset
    ? release?.assets.find((item) => item.address === row.asset?.toLowerCase())
    : undefined;
  const bet: ReceiptPageBet = {
    chainId,
    betId,
    ...(row?.gameHub ? { gameHub: row.gameHub.toLowerCase() } : {}),
    ...(game ? { gameSlug: game.slug, gameLabel: game.label } : {}),
    symbol: asset?.symbol ?? "",
    decimals: asset?.decimals ?? 18
  };

  if (!response) return { kind: "degraded", bet };
  if (!row) return { kind: response.source === "postgres" ? "missing" : "degraded", bet };
  if (row.state === "placed" || row.state === "randomReady") {
    const stake = row.stake ? toBigInt(row.stake) : undefined;
    return {
      kind: "pending",
      bet,
      state: row.state,
      ...(stake == null ? {} : { stake: exactAmount(stake, bet.decimals) }),
      ...(row.requestId ? { requestId: row.requestId } : {}),
      ...(row.placedBlock == null ? {} : { placedBlock: row.placedBlock }),
      ...(row.refundDeadline == null ? {} : { refundDeadline: row.refundDeadline })
    };
  }

  const proof = response.payment;
  const payment =
    proof && (proof.status === "transferred" || proof.status === "payable")
      ? { status: proof.status, amount: proof.amount }
      : undefined;
  const receipt = receiptFromRow(row, { chainId, decimals: bet.decimals, payment });
  if (!receipt || !asset) return { kind: "indexing", bet, state: row.state };

  const pools = release?.pools.filter((pool) => pool.asset === asset.address) ?? [];
  const allocation = row.houseEdge ? allocationOf(row.houseEdge, bet.decimals) : undefined;
  const houseEdgeBps = row.houseEdge?.houseEdgeBps ?? release?.defaultHouseEdgeBps;
  return {
    kind: "printed",
    bet,
    receipt,
    ...(houseEdgeBps == null ? {} : { houseEdgeBps }),
    // Evidence for another amount proves nothing about this bet's payment.
    ...(payment && payment.amount === getCasinoCashReturned(row)?.toString()
      ? { payment: payment.status }
      : {}),
    ...(pools.length === 1 ? { poolId: pools[0]!.poolId } : {}),
    ...(row.player ? { player: row.player } : {}),
    ...(row.referrerL1 ? { referrerL1: row.referrerL1 } : {}),
    ...(row.referrerL2 ? { referrerL2: row.referrerL2 } : {}),
    asset: asset.address,
    ...(row.placedBlock == null ? {} : { placedBlock: row.placedBlock }),
    lastEventName: row.lastEventName,
    indexedAt: row.updatedAt,
    source: response.source === "postgres" ? "index" : "chain",
    ...(allocation ? { allocation } : {})
  };
}
