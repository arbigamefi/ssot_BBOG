export interface DomainBankSnapshot {
  chainId: number;
  poolId: number;
  asset: `0x${string}`;
  bank: `0x${string}`;
  totalAssets: bigint; // NAV
  totalReserved: bigint;
  minLiquidityBps?: number;
  protocolFeesPayable?: bigint;
  externalPayablesTotal?: bigint;
  updatedAtBlock?: bigint;
}

export interface DomainBankPosition {
  poolId: number;
  user: `0x${string}`;
  shares: bigint;
  assetsEquivalent: bigint;
}

export interface DomainXPBuckets {
  payee: `0x${string}`;
  accrued: bigint;
  locked: bigint;
  holdback: bigint;
  holdbackReleasable: bigint;
}
