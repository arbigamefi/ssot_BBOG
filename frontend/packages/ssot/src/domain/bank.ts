export interface DomainBankSnapshot {
  chainId: number;
  poolId: number;
  asset: `0x${string}`;
  bank: `0x${string}`;
  totalAssets: bigint; // NAV
  totalSupply: bigint; // LP share supply
  assetsPerShare: bigint; // assets represented by one whole share unit
  totalReserved: bigint;
  /**
   * Legacy compatibility alias. In v1.4+ this maps to riskReserveBps.
   * New-risk solvency should prefer riskReserveBps when present.
   */
  minLiquidityBps?: number;
  riskReserveBps?: number;
  riskReserve?: bigint;
  riskFree?: bigint;
  withdrawalBufferBps?: number;
  withdrawalBuffer?: bigint;
  withdrawable?: bigint;
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
