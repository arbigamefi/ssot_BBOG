import type { BetRow } from "@ssot/ssot/indexer";
import type { SportsTicketRow } from "@ssot/bet-index";

export type BetStatusFilter = "all" | "open" | "won" | "lost";

export type BetStatusGroup =
  | "pending"
  | "placed"
  | "pending_vrf"
  | "won"
  | "lost"
  | "settled"
  | "refunded"
  | "failed";

export type BetMetric = {
  label: string;
  value: string;
  detail: string;
};

export type EnrichedBetRow = {
  kind: "casino";
  id: string;
  detailHref: string;
  row: BetRow;
  status: BetStatusGroup;
  gameLabel: string;
  assetSymbol: string;
  decimals: number;
  stake: bigint;
  payout?: bigint;
  outcomeLabel: string;
  relativeTime: string;
  updatedBlock: number;
};

export type EnrichedSportsTicketRow = {
  kind: "sports";
  id: string;
  detailHref: string;
  row: SportsTicketRow;
  status: BetStatusGroup;
  gameLabel: string;
  assetSymbol: string;
  decimals: number;
  stake: bigint;
  payout?: bigint;
  outcomeLabel: string;
  relativeTime: string;
  updatedBlock: number;
};

export type EnrichedActivityRow = EnrichedBetRow | EnrichedSportsTicketRow;
