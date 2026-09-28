import type { BetRow } from "@ssot/ssot/indexer";
import type { PlayerPaymentProof } from "@ssot/bet-index/player-payment";

export type RecentBetRow = BetRow;

export type RecentBetsResponse = {
  schemaVersion: 1;
  chainId: number;
  source: "postgres" | "rpc-window";
  cached: boolean;
  generatedAt: number;
  fromBlock: number;
  toBlock: number;
  rows: RecentBetRow[];
};

export type PlayerBetsResponse = RecentBetsResponse & {
  player: string;
};

export type AffiliateBetsResponse = RecentBetsResponse & {
  affiliate: string;
  asset?: string;
  stats: {
    affiliate: string;
    betCount: number;
    settledCount: number;
    turnover: string;
    payout: string;
    payoutGross: string;
  } | null;
};

export type BetReceiptResponse = Omit<RecentBetsResponse, "fromBlock" | "rows" | "toBlock"> & {
  betId: string;
  row: RecentBetRow | null;
  /** Historical terminal-transaction payment evidence, not the player's current aggregate claim balance. */
  payment?: PlayerPaymentProof;
};

export type RecentBetsQuery = {
  chainId: number;
  gameId?: string;
  limit: number;
};
