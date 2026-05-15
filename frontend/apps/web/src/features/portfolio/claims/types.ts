import type { DomainBankSnapshot, DomainError, DomainXPBuckets } from "@ssot/ssot";
import type { TxStepItem, TxStatus } from "@ssot/ui";

export type ClaimsAction = "claim" | "sync" | "fees";

export type ClaimsFlowState = {
  status: TxStatus;
  steps: readonly TxStepItem[];
  hasActivity: boolean;
  busy: boolean;
  error?: DomainError;
  txHash?: string;
  blockNumber?: number;
  reset: () => void;
};

export type ClaimsMetric = {
  label: string;
  value: string;
  detail: string;
};

export type ClaimsData = {
  buckets?: DomainXPBuckets;
  snapshot?: DomainBankSnapshot;
};
