import type { DomainBankPosition, DomainBankSnapshot, DomainBet, DomainError, DomainXPBuckets } from "../domain";

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type TxStep =
  | { type: "approve"; token: Address; spender: Address; amount: bigint }
  | {
      type: "placeBet";
      to: Address;
      value: bigint; // msg.value: VRF fee
      call: {
        contract: "Hub";
        fn: "placeBet";
        argsSummary: Record<string, unknown>;
      };
    };

export interface PlaceBetInput {
  chainId: number;
  gameId: Hex;
  asset: Address;
  betCount: number;
  stake: bigint;
  params: Hex; // bytes
  stakeSpec: Hex; // bytes
  affiliate?: Address;
  maxHouseEdgeBps: number;
}

export interface PlaceBetPlan {
  chainId: number;
  releaseDigest: string;
  warnings: string[];
  steps: TxStep[];
  // Opaque but executable payload; this is the SSOT "truth" used by executePlan.
  payload: {
    gameId: Hex;
    asset: Address;
    params: Hex; // bytes
    stakeSpec: {
      amountPerRoll: bigint;
      betCount: number;
      stopGain: bigint;
      stopLoss: bigint;
    };
    affiliate: Address;
    maxHouseEdgeBps: number;
  };
  preview: {
    vrfFee: bigint;
    stake: bigint;
    /** Current allowance (player -> bank) observed during planning. */
    allowance: bigint;
    /** Whether an approve transaction is required before placeBet. */
    needsApproval: boolean;
    /** The approve amount used (note: approve sets allowance, it is NOT additive). */
    approveAmount?: bigint;
    /** Bank free liquidity at planning time (may change by execution). */
    freeLiquidity?: bigint;
    /** Max payout the bet requires the bank to reserve. */
    requiredReserve?: bigint;
  };
}

export interface TxResult {
  txHash: Hex;
  ok: boolean;
  error?: DomainError;
}

export interface ExecutePlanResult {
  approveTx?: TxResult;
  placeBetTx: TxResult;
  betId?: bigint;
}

export type ReconcilePlaceBetTxResult =
  | { ok: true; betId: bigint; source: "receipt" }
  | { ok: false; error: DomainError };

export type BindPlaceBetTxResult =
  | { ok: true; betId: bigint; source: "manual" }
  | { ok: false; error: DomainError };


export interface SSOTHubAPI {
  quoteVRFFee(betCount: number): Promise<bigint>;
  planPlaceBet(input: PlaceBetInput): Promise<PlaceBetPlan | { error: DomainError }>;
  executePlan(plan: PlaceBetPlan): Promise<ExecutePlanResult>;

  /**
   * Best-effort reconciliation of a placeBet transaction into a betId.
   *
   * This is a pure read operation: it will NOT send any transaction.
   */
  reconcilePlaceBetTx(txHash: Hex): Promise<ReconcilePlaceBetTxResult>;

  /**
   * Manual bind for when reconciliation is unavailable (or the user already knows the betId).
   * MUST verify that bet.player equals the connected wallet account.
   */
  bindPlaceBetTx(txHash: Hex, betId: bigint): Promise<BindPlaceBetTxResult>;

  refund(betId: bigint): Promise<TxResult>;

  /**
   * Finalize a bet that is in `randomReady` state.
   * This pushes the bet from randomReady → finalized (settled).
   * Anyone can call this (not just the bet owner).
   */
  finalize(betId: bigint): Promise<TxResult>;

  /**
   * Bind a referrer for the connected wallet.
   * Once bound, the referrer relationship is permanent.
   */
  bindReferrer(referrer: Address): Promise<TxResult>;

  /**
   * Query the referrer of a given player.
   * Returns zero address if no referrer is bound.
   */
  referrerOf(player: Address): Promise<Address>;

  getBet(betId: bigint): Promise<DomainBet>;
}


export interface SSOTBankAPI {
  getSnapshot(asset: Address): Promise<DomainBankSnapshot>;
  getPosition(asset: Address, user: Address): Promise<DomainBankPosition>;

  // ERC4626-like vault operations
  deposit(assets: bigint, receiver: Address): Promise<TxResult & { shares?: bigint }>;
  withdraw(assets: bigint, receiver: Address, owner: Address): Promise<TxResult & { shares?: bigint }>;
  redeem(shares: bigint, receiver: Address, owner: Address): Promise<TxResult & { assets?: bigint }>;
  mint(shares: bigint, receiver: Address): Promise<TxResult & { assets?: bigint }>;

  /** Maximum assets the owner can withdraw (accounting for reserves and solvency). */
  maxWithdraw(owner: Address): Promise<bigint>;
  /** Maximum shares the owner can redeem. */
  maxRedeem(owner: Address): Promise<bigint>;
  /** Player's cumulative turnover (used for XP unlock eligibility check). */
  playerTurnover(player: Address): Promise<bigint>;

  // Protocol fee claim (governance only)
  claimProtocolFees(amount: bigint, receiver: Address): Promise<TxResult & { claimed?: bigint }>;

  // XP claim + bucket management
  claimXPAccrued(amount: bigint, receiver: Address): Promise<TxResult & { claimed?: bigint }>;
  getXPBuckets(payee: Address): Promise<DomainXPBuckets>;
  unlockXPLocked(payee: Address, sourcePlayer: Address): Promise<TxResult>;
  syncXPHoldback(payee: Address): Promise<TxResult>;
}

export interface SSOTVRFHubAPI {
  getRefundCredit(user: Address): Promise<bigint>;
  claimRefundCredit(): Promise<TxResult>;
}
