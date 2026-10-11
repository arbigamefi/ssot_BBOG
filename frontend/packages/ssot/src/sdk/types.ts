import type {
  DomainBankSnapshot,
  DomainDepositPosition,
  DomainDepositPage,
  DomainDepositWithdrawalQuote,
  DepositCursor,
  DomainBet,
  DomainError,
  DomainXPBuckets
} from "../domain";
import type { PlayerPaymentProof } from "@ssot/bet-index/player-payment";
export type { PlayerPaymentProof } from "@ssot/bet-index/player-payment";

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
    gasPrice: bigint;
    quoteBlockNumber: bigint;
    stake: bigint;
    /** Current allowance (player -> betting hub) observed during planning. */
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

export type VaultProviderLedgerEntry = {
  id: string;
  action: "deposit" | "withdraw" | "transfer";
  depositId: bigint;
  txHash: Hex;
  blockNumber: number;
  logIndex: number;
  timestamp?: number;
  assets?: bigint;
  payer?: Address;
  owner?: Address;
  from?: Address;
  to?: Address;
  percent?: bigint;
  withdrawAfter?: bigint;
};

export interface GameConfig {
  /** Current on-chain fee, read at the same block as the admission configuration. */
  houseEdgeBps: number;
  gameId: Hex;
  module: Address;
  maxBetCount: number;
  callbackGasLimit: number;
}

export type GameHubSettlementProof = {
  /** Historical terminal transaction delivery; payable does not imply still unclaimed today. */
  payment?: PlayerPaymentProof;
  txHash?: Hex;
  blockNumber?: bigint;
  payoutGross?: bigint;
  payoutNet?: bigint;
  /** Unused stake returned in addition to payoutNet. Undefined means not yet proven. */
  refundAmount?: bigint;
  feeOnPayout?: bigint;
  protocolFeeAccrual?: bigint;
};

export type GameHubRefundProof = {
  payment?: PlayerPaymentProof;
  txHash?: Hex;
  blockNumber?: bigint;
  refundAmount?: bigint;
};

export type GameHubTerminalProof =
  | { kind: "settled"; settlement: GameHubSettlementProof }
  | { kind: "refunded"; refund: GameHubRefundProof };

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
  getGameConfig(gameId: Hex, opts?: { blockNumber?: bigint }): Promise<GameConfig>;
  quoteVRFFee(gameId: Hex, betCount: number, gasPriceBudget?: bigint): Promise<bigint>;
  planPlaceBet(input: PlaceBetInput): Promise<PlaceBetPlan | { error: DomainError }>;
  executePlan(
    plan: PlaceBetPlan,
    onStage?: (stage: "approve" | "placeBet") => void
  ): Promise<ExecutePlanResult>;

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
   * Retry settlement using the canonical received seed, including an undelivered Hub receipt.
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
  getBetParams(betId: bigint): Promise<Hex>;
  getBetRandomWords(betId: bigint): Promise<bigint[]>;
  getTerminalProof(betId: bigint): Promise<GameHubTerminalProof | null>;
}

export interface SSOTLiquidityVaultAPI {
  getDeposit(
    poolId: number,
    depositId: bigint,
    opts?: { blockNumber?: bigint }
  ): Promise<DomainDepositPosition>;
  getDeposits(
    poolId: number,
    owner: Address,
    opts?: { cursor?: DepositCursor; limit?: number; blockNumber?: bigint }
  ): Promise<DomainDepositPage>;
  quoteWithdrawal(
    poolId: number,
    depositId: bigint,
    percent: bigint,
    opts?: { blockNumber?: bigint }
  ): Promise<DomainDepositWithdrawalQuote>;
  getAllowance(poolId: number, owner: Address): Promise<bigint>;
  /** Creates a new NFT. Asset approval targets the Vault, never the Bank. */
  addDeposit(poolId: number, assets: bigint, owner?: Address): Promise<TxResult>;
  /** Only the current NFT owner may withdraw; assets are paid to that owner. */
  withdrawDeposit(poolId: number, depositId: bigint, percent: bigint): Promise<TxResult>;
  getProviderLedger(
    poolId: number,
    owner: Address,
    opts?: {
      startBlock?: number;
      endBlock?: number;
      beforeBlock?: number;
      beforeLogIndex?: number;
      limit?: number;
    }
  ): Promise<VaultProviderLedgerEntry[]>;
}

export interface SSOTBankAPI {
  getSnapshot(poolId: number, opts?: { blockNumber?: bigint }): Promise<DomainBankSnapshot>;
  getAssetBalance(asset: Address, user: Address): Promise<bigint>;
  getPlayerPayable(
    poolId: number,
    player: Address,
    opts?: { blockNumber?: bigint }
  ): Promise<bigint>;
  /** Permissionless trigger; payment goes only to the specified player. */
  claimPlayerPayable(poolId: number, player?: Address): Promise<TxResult>;

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
