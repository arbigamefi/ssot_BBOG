export interface DomainRedeemBatch {
  batchId: bigint;
  /** Earliest activation time; queued requests remain cancellable after this time. */
  cutoff: bigint;
  priced: boolean;
  shares: bigint;
  assets: bigint;
  assignedShares: bigint;
  assignedAssets: bigint;
  /** Actual risk boundary; zero while the batch is still queued. */
  activatedAt: bigint;
  fullExit: boolean;
}

export interface DomainControllerRedeemBatch extends DomainRedeemBatch {
  controllerShares: bigint;
  cancellableShares: bigint;
  liquidAssets: bigint;
  /** Additional recovery upper bound for queued shares; not claimable cash. */
  recoveryAssets: bigint;
}

export interface DomainRecoveryPosition {
  epochId: bigint;
  activatedAt: bigint;
  shares: bigint;
  claimableAssets: bigint;
  claimedAssets: bigint;
  /** Additional future assets if all remaining positions have zero terminal cost. */
  pendingAssets: bigint;
  finalSynced: boolean;
  remainingHolds: bigint;
  remainingReserve: bigint;
  updatedAtBlock: bigint;
  snapshotTimestamp: bigint;
}

/** Opaque continuation pinned to one canonical chain snapshot and one Bank/controller. */
export interface BankRecoveryCursor {
  bank: `0x${string}`;
  controller: `0x${string}`;
  chainId: number;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  beforeEpoch: bigint;
}

export interface DomainRecoveryPage {
  items: DomainRecoveryPosition[];
  nextCursor?: BankRecoveryCursor;
  /** True only after discovery reaches the first sealed epoch. */
  complete: boolean;
  updatedAtBlock: bigint;
  snapshotTimestamp: bigint;
}

export interface DomainBankSnapshot {
  chainId: number;
  poolId: number;
  asset: `0x${string}`;
  bank: `0x${string}`;
  totalAssets: bigint; // active NAV; excludes recovery backing and fixed payables
  totalSupply: bigint; // active LP share supply; queued shares burn at activation
  assetsPerShare: bigint; // assets represented by one whole share unit
  /** Global reserve includes all historical recovery pockets. */
  totalReserved: bigint;
  activeReserved: bigint;
  recoveryBacking: bigint;
  activeOpenHolds: bigint;
  currentEpoch: bigint;
  openHolds: bigint;
  /** Liabilities already excluded from totalAssets; do not subtract them again. */
  exitPayable: bigint;
  playerPayableTotal: bigint;
  batchPeriod: bigint;
  queuedBatch: DomainRedeemBatch | null;
  snapshotTimestamp: bigint;
  /** Live Bank pause state; read with the rest of the snapshot. */
  riskInPaused: boolean;
  riskReserveBps: number;
  riskReserve: bigint;
  riskFree: bigint;
  withdrawalBufferBps: number;
  withdrawalBuffer: bigint;
  withdrawable: bigint;
  protocolFeesPayable: bigint;
  externalPayablesTotal: bigint;
  /** Lifetime asset turnover recorded by the Bank, net of refunded stake. */
  totalTurnover: bigint;
  /** Lifetime gross payout before the house-edge deduction. */
  totalPayoutGross: bigint;
  /** Lifetime net payout owed to players, including recorded deferred payments. */
  totalPayoutNet: bigint;
  /** Lifetime refunded stake. */
  totalRefunded: bigint;
  /** Lifetime house-edge amount deducted from gross payouts; distinct from PF accrual. */
  totalFeeOnPayout: bigint;
  /** Lifetime protocol fee accrued by settlement. */
  totalProtocolFeeAccrued: bigint;
  /** Lifetime count of bet holds opened against this Bank. */
  totalBetsHeld: bigint;
  /** Lifetime count of terminal settled bets. */
  totalBetsSettled: bigint;
  /** Lifetime count of refunded bets. */
  totalBetsRefunded: bigint;
  updatedAtBlock: bigint;
}

export interface DomainBankPosition {
  poolId: number;
  user: `0x${string}`;
  shares: bigint;
  assetsEquivalent: bigint;
  /** Queued shares remain active until the actual activation transaction. */
  queuedShares: bigint;
  queuedLiquidAssets: bigint;
  queuedRecoveryAssets: bigint;
  queuedBatch: DomainControllerRedeemBatch | null;
  claimableShares: bigint;
  claimableAssets: bigint;
  cancellableShares: bigint;
  /** Separate player debt; excluded from LP equity. */
  playerPayable: bigint;
  /** Wallet indicative equity + queued liquid quote + fixed liquid claims. Excludes recovery rights. */
  activeAndClaimableAssets: bigint;
  snapshotTimestamp: bigint;
  updatedAtBlock: bigint;
}

export interface DomainXPBuckets {
  payee: `0x${string}`;
  accrued: bigint;
  locked: bigint;
  holdback: bigint;
  holdbackReleasable: bigint;
}
