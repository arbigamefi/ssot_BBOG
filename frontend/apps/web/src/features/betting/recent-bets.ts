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

export type RecentBetsQuery = {
  chainId: number;
  gameId?: string;
  limit: number;
};
