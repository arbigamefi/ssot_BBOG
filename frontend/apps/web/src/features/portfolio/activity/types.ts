import type { BetRow } from "@ssot/ssot/indexer";

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
  row: BetRow;
  status: BetStatusGroup;
  gameLabel: string;
  assetSymbol: string;
  decimals: number;
  stake: bigint;
  payout?: bigint;
  outcomeLabel: string;
  relativeTime: string;
};
