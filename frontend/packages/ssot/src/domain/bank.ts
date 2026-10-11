export type LPStatus =
  | "ready"
  | "busy"
  | "unbookedResult"
  | "invalidAccounting"
  | "unavailable"
  | "coolingDown"
  | "noLiquidity";

/** Authoritative two-custodian accounting at one block; NFT counts are not capital. */
export interface DomainBankSnapshot {
  chainId: number;
  poolId: number;
  asset: `0x${string}`;
  bank: `0x${string}`;
  vault: `0x${string}`;
  L: bigint;
  P: bigint;
  R: bigint;
  K: bigint;
  G: bigint;
  bankCash: bigint;
  vaultCash: bigint;
  bankSurplus: bigint;
  vaultSurplus: bigint;
  accountingValid: boolean;
  lpStatus: LPStatus;
  unbookedResultCount: bigint;
  openHolds: bigint;
  maxOpenHolds: bigint;
  minBetAmount: bigint;
  lpFreeCapital: bigint;
  playerPayableTotal: bigint;
  riskInPaused: boolean;
  riskReserveBps: number;
  riskReserve: bigint;
  riskFree: bigint;
  /** These buffers govern optional PF/XP outflows, never NFT withdrawal quotes. */
  withdrawalBufferBps: number;
  withdrawalBuffer: bigint;
  protocolFeesPayable: bigint;
  externalPayablesTotal: bigint;
  totalTurnover: bigint;
  totalPayoutGross: bigint;
  totalPayoutNet: bigint;
  totalRefunded: bigint;
  totalFeeOnPayout: bigint;
  totalProtocolFeeAccrued: bigint;
  totalBetsHeld: bigint;
  totalBetsSettled: bigint;
  totalBetsRefunded: bigint;
  snapshotTimestamp: bigint;
  updatedAtBlock: bigint;
}

export interface DomainDepositPosition {
  poolId: number;
  asset: `0x${string}`;
  bank: `0x${string}`;
  vault: `0x${string}`;
  depositId: bigint;
  owner: `0x${string}`;
  assets: bigint;
  withdrawAfter: bigint;
  /** Protocol precision: 1e12 = 100%. */
  maxPercent: bigint;
  maxAssets: bigint;
  status: LPStatus;
  snapshotTimestamp: bigint;
  updatedAtBlock: bigint;
}

/** Enumeration indexes are meaningful only at this authenticated owner/block snapshot. */
export interface DepositCursor {
  chainId: number;
  poolId: number;
  vault: `0x${string}`;
  owner: `0x${string}`;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  nextIndex: bigint;
  nftCount: bigint;
}

export interface DomainDepositPage {
  items: DomainDepositPosition[];
  /** ERC721 balanceOf: number of NFTs, not an asset value. */
  nftCount: bigint;
  nextCursor?: DepositCursor;
  complete: boolean;
  snapshotTimestamp: bigint;
  updatedAtBlock: bigint;
}

export interface DomainDepositWithdrawalQuote {
  position: DomainDepositPosition;
  percent: bigint;
  assets: bigint;
  executable: boolean;
  closeOnly: boolean;
  /** Includes percentage/rounding rejection; ownership is checked again before writing. */
  reason?: LPStatus | "invalidPercent" | "zeroWithdrawal" | "insufficientFreeCapital";
}

export interface DomainXPBuckets {
  payee: `0x${string}`;
  accrued: bigint;
  locked: bigint;
  holdback: bigint;
  holdbackReleasable: bigint;
}
