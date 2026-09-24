export interface DomainBankSnapshot {
  chainId: number;
  poolId: number;
  asset: `0x${string}`;
  bank: `0x${string}`;
  totalAssets: bigint; // NAV
  totalSupply: bigint; // LP share supply
  assetsPerShare: bigint; // assets represented by one whole share unit
  totalReserved: bigint;
  /** Live Bank pause state; absence must not be interpreted as open. */
  riskInPaused?: boolean;
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
  /** Lifetime asset turnover recorded by the Bank, net of refunded stake. */
  totalTurnover?: bigint;
  /** Lifetime gross payout before protocol-fee deduction. */
  totalPayoutGross?: bigint;
  /** Lifetime net payout actually transferred to players. */
  totalPayoutNet?: bigint;
  /** Lifetime refunded stake. */
  totalRefunded?: bigint;
  /** Lifetime protocol fee retained from gross payouts. */
  totalFeeOnPayout?: bigint;
  /** Lifetime protocol fee accrued by settlement. */
  totalProtocolFeeAccrued?: bigint;
  /** Lifetime count of bet holds opened against this Bank. */
  totalBetsHeld?: bigint;
  /** Lifetime count of terminal settled bets. */
  totalBetsSettled?: bigint;
  /** Lifetime count of refunded bets. */
  totalBetsRefunded?: bigint;
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
