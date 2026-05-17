import type { TxStepItem, TxStatus } from "@ssot/ui";

export type PortfolioAssetRow = {
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

export type PortfolioJournalRow = {
  id: string;
  createdAt: number;
  action: string;
  status: string;
  txHash?: string;
  blockNumber?: number;
  releaseDigest: string;
  chainId: number;
};

export type PortfolioMetric = {
  label: string;
  value: string;
  detail: string;
};

export type PortfolioFlowState = {
  status: TxStatus;
  steps: readonly TxStepItem[];
  hasActivity: boolean;
  busy: boolean;
  error?: { message: string; details?: unknown };
  txHash?: string;
  blockNumber?: number;
  reset: () => void;
};
