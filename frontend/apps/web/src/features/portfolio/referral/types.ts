import type { DomainError } from "@ssot/ssot";
import type { TxStepItem, TxStatus } from "@ssot/ui";

export type ReferralFlowState = {
  status: TxStatus;
  steps: readonly TxStepItem[];
  hasActivity: boolean;
  busy: boolean;
  error?: DomainError;
  txHash?: string;
  blockNumber?: number;
  reset: () => void;
};

export type ReferralMetric = {
  label: string;
  value: string;
  detail: string;
};
