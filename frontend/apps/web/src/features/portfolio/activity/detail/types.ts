import type { DomainBet } from "@ssot/ssot";
import type { BetRow, GameHubEventRow } from "@ssot/ssot/indexer";

export type BetDetailMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "danger" | "brand";
};

export type BetDetailFact = {
  label: string;
  value: string;
  copyValue?: string;
  href?: string;
};

export type BetDetailContext = {
  betId: string;
  stateLabel: string;
  gameLabel: string;
  symbol: string;
  decimals: number;
  explorerBaseUrl?: string;
  primaryTxHash?: string;
  localBet?: BetRow | null;
  onChainBet?: DomainBet | null;
  timeline: GameHubEventRow[];
};
