import type { BetRow } from "@ssot/ssot/indexer";

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
  };
};

export type BetReceiptResponse = Omit<RecentBetsResponse, "fromBlock" | "rows" | "toBlock"> & {
  betId: string;
  row: RecentBetRow | null;
};

export type RecentBetsQuery = {
  chainId: number;
  gameId?: string;
  limit: number;
};
