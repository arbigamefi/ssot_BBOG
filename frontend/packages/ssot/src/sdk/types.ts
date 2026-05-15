import type {
  DomainBankPosition,
  DomainBankSnapshot,
  DomainBet,
  DomainError,
  DomainSportsMarket,
  DomainSportsResult,
  DomainSportsTicket,
  DomainXPBuckets
} from "../domain";

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type TxStep =
  | { type: "approve"; token: Address; spender: Address; amount: bigint }
  | {
      type: "placeBet";
      to: Address;
      value: bigint; // msg.value: VRF fee
      call: {
        contract: "GameHub";
        fn: "placeBet";
        argsSummary: Record<string, unknown>;
      };
    };

export interface PlaceBetInput {
  chainId: number;
  gameId: Hex;
  poolId: number;
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
    poolId: number;
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
    asset: Address;
    bank: Address;
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

export interface SSOTGameHubAPI {
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
  getSnapshot(poolId: number): Promise<DomainBankSnapshot>;
  getPosition(poolId: number, user: Address): Promise<DomainBankPosition>;
  getAssetBalance(asset: Address, user: Address): Promise<bigint>;
  getAllowance(poolId: number, owner: Address): Promise<bigint>;

  // ERC4626-like vault operations
  deposit(
    poolId: number,
    assets: bigint,
    receiver: Address
  ): Promise<TxResult & { shares?: bigint }>;
  withdraw(
    poolId: number,
    assets: bigint,
    receiver: Address,
    owner: Address
  ): Promise<TxResult & { shares?: bigint }>;
  redeem(
    poolId: number,
    shares: bigint,
    receiver: Address,
    owner: Address
  ): Promise<TxResult & { assets?: bigint }>;
  mint(poolId: number, shares: bigint, receiver: Address): Promise<TxResult & { assets?: bigint }>;

  /** Maximum assets the owner can withdraw (accounting for reserves and solvency). */
  maxWithdraw(poolId: number, owner: Address): Promise<bigint>;
  /** Maximum shares the owner can redeem. */
  maxRedeem(poolId: number, owner: Address): Promise<bigint>;
  /** Player's cumulative turnover (used for XP unlock eligibility check). */
  playerTurnover(poolId: number, player: Address): Promise<bigint>;

  // Protocol fee claim (governance only)
  claimProtocolFees(
    poolId: number,
    amount: bigint,
    receiver: Address
  ): Promise<TxResult & { claimed?: bigint }>;

  // XP claim + bucket management
  claimXPAccrued(
    poolId: number,
    amount: bigint,
    receiver: Address
  ): Promise<TxResult & { claimed?: bigint }>;
  getXPBuckets(poolId: number, payee: Address): Promise<DomainXPBuckets>;
  unlockXPLocked(poolId: number, payee: Address, sourcePlayer: Address): Promise<TxResult>;
  syncXPHoldback(poolId: number, payee: Address): Promise<TxResult>;
}

export interface SSOTVRFHubAPI {
  getRefundCredit(user: Address): Promise<bigint>;
  claimRefundCredit(): Promise<TxResult>;
}

export interface CreateSportsMarketInput {
  eventId: bigint;
  poolId: number;
  outcomeCount: number;
  startsAt: bigint;
  lockTime: bigint;
  resultFinalitySeconds: bigint;
  marketKey: Hex;
  rulebookHash: Hex;
}

export interface ProposeSportsResultInput {
  marketId: bigint;
  winningOutcomeId: number;
  resultSourceHash: Hex;
  evidenceHash: Hex;
  observedAt: bigint;
  reporterSignatures?: readonly Hex[];
}

export interface SSOTSportsHubAPI {
  getNextMarketId(): Promise<bigint>;
  getNextTicketId(): Promise<bigint>;
  getMarket(marketId: bigint): Promise<DomainSportsMarket>;
  getTicket(ticketId: bigint): Promise<DomainSportsTicket>;
  getResult(marketId: bigint): Promise<DomainSportsResult>;
  getMarketReserved(marketId: bigint): Promise<bigint>;
  getMarketOutcomeReserved(marketId: bigint, outcomeId: number): Promise<bigint>;
  getEventReserved(eventId: bigint): Promise<bigint>;
  getPoolEventReserved(poolId: number, eventId: bigint): Promise<bigint>;
  createMarket(input: CreateSportsMarketInput): Promise<TxResult>;
  openMarket(marketId: bigint): Promise<TxResult>;
  suspendMarket(marketId: bigint, suspended: boolean): Promise<TxResult>;
  lockMarket(marketId: bigint): Promise<TxResult>;
  voidMarket(marketId: bigint, reasonHash: Hex): Promise<TxResult>;
  proposeResult(input: ProposeSportsResultInput): Promise<TxResult>;
  finalizeResult(marketId: bigint): Promise<TxResult>;
  settleTicket(ticketId: bigint): Promise<TxResult>;
  settleTickets(ticketIds: readonly bigint[]): Promise<TxResult>;
  refundTicket(ticketId: bigint): Promise<TxResult>;
  refundTickets(ticketIds: readonly bigint[]): Promise<TxResult>;
  voidTicket(ticketId: bigint): Promise<TxResult>;
  voidTickets(ticketIds: readonly bigint[]): Promise<TxResult>;
}
