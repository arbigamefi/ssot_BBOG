import type { SportsTicketRow } from "@ssot/bet-index";

export type RecentSportsTicketRow = SportsTicketRow;

export type PlayerSportsTicketsResponse = {
  schemaVersion: 1;
  chainId: number;
  source: "postgres" | "rpc-window";
  cached: boolean;
  generatedAt: number;
  fromBlock: number;
  toBlock: number;
  player: string;
  rows: RecentSportsTicketRow[];
};
