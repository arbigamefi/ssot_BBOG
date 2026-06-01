import type { DomainBankPosition, DomainBankSnapshot } from "@ssot/ssot";

export type EarnTab = "deposit" | "withdraw";

export type EarnAmountMode = "assets" | "shares";

export type EarnBankData = {
  snapshot: DomainBankSnapshot;
  position: DomainBankPosition | null;
};

export type EarnMetric = {
  label: string;
  value: string;
  detail: string;
};

export type EarnProviderLedgerAction = "deposit" | "withdraw";

export type EarnProviderLedgerEntry = {
  id: string;
  action: EarnProviderLedgerAction;
  txHash: `0x${string}`;
  blockNumber: number;
  logIndex: number;
  timestamp?: number;
  assets?: bigint;
  shares: bigint;
  sharePrice?: bigint;
};
