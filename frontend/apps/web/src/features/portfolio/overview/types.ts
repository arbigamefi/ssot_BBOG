import type { TxStepItem, TxStatus } from "@ssot/ui";

export type AccountAssetRow = {
  id: string;
  symbol: string;
  decimals: number;
  asset: `0x${string}`;
  bank: `0x${string}`;
  walletBalance: bigint;
  shares: bigint;
  assetsEquivalent: bigint;
  allowance: bigint;
};

export type AccountJournalRow = {
  id: string;
  createdAt: number;
  action: string;
  status: string;
  txHash?: string;
  blockNumber?: number;
  releaseDigest: string;
  chainId: number;
};

export type AccountMetric = {
  label: string;
  value: string;
  detail: string;
};

export type AccountFlowState = {
  status: TxStatus;
  steps: readonly TxStepItem[];
  hasActivity: boolean;
  busy: boolean;
  error?: { message: string; details?: unknown };
  txHash?: string;
  blockNumber?: number;
  reset: () => void;
};
