import type { Address, Hex } from "viem";
import type { VaultProviderLedgerPool } from "./vault-provider-ledger.js";

/** SSOTTypes.BetState, in order. */
export type BetStateName =
  | "none"
  | "held"
  | "pendingVrf"
  | "randomReady"
  | "settled"
  | "refunded"
  | "voided";

export type KeeperRole = "primary" | "backup";

export type KeeperEventSource = "gameHub" | "vrfHub" | "scan" | "manual" | "void";

export type KeeperEvent = {
  source: KeeperEventSource;
  betId: bigint;
  requestId?: bigint;
  randomHash?: Hex;
  blockNumber?: bigint;
  /**
   * Block of the canonical `ResultReceived` or the bet's `BetRandomReady`, when the event that queued
   * the bet showed the result: when the result was received.
   */
  resultBlockNumber?: bigint;
  txHash?: Hex;
  receivedAt: number;
};

export type KeeperConfig = {
  chainId: number;
  gameHub: Address;
  vrfHub: Address;
  /** The release PoolRegistry. Its governance is the timelock the keeper indexes. */
  poolRegistry?: Address;
  /** Every Bank of the release, active or not; each must share the PoolRegistry's governance. */
  releaseBanks?: Address[];
  httpRpcUrl: string;
  wsRpcUrl?: string;
  privateKey: Hex;
  role: KeeperRole;
  backupDelayMs: number;
  pollIntervalMs: number;
  rpcMinIntervalMs: number;
  scanChunkBlocks: bigint;
  /** Upper bound on chunks per catch-up pass; bounds provider cost when a cursor falls behind. */
  scanMaxChunksPerPass: number;
  scanIndexEventsEnabled: boolean;
  startupScanEnabled: boolean;
  startBlock?: bigint;
  /** Independent full lifecycle recovery origin. */
  casinoRecoveryStartBlock?: bigint;
  healthPath?: string;
  betIndexDatabaseUrl?: string;
  betIndexSsl: boolean;
  betIndexWriteEnabled: boolean;
  vaultProviderLedgerPools: VaultProviderLedgerPool[];
  vaultProviderLedgerScanIntervalMs: number;
  /**
   * Gas limit of every voidBet simulation and transaction. Startup checks it against the GameHub floor
   * (VOID_SETTLEMENT_GAS + VOID_RESERVE_GAS + VOID_CALL_OVERHEAD + 150,000) and Base's transaction cap.
   */
  voidGasLimit: bigint;
  /**
   * Payables, Vault ledger and governance scanning degrade when the finalized head they read has not
   * advanced for this long. Default one hour; zero disables the check.
   */
  finalizedStallMs?: number;
};

export type BetRead = {
  betId: bigint;
  requestId: bigint;
  state: BetStateName;
  refundDeadline?: bigint;
  bank?: Address;
  /** Seconds; the void delays count from it. */
  vrfRequestedAt?: bigint;
};

export type FinalizeOutcome =
  | { kind: "settled"; txHash: Hex; latencyMs: number }
  | { kind: "raced"; state: BetStateName }
  | { kind: "skipped"; state: BetStateName }
  | {
      kind: "deferred";
      state: BetStateName;
      retryAfterMs: number;
      /**
       * Set when the result was received but its settlement reverts: the chain time (seconds) from
       * which voidBet may be called. Absent for a PendingVRF bet waiting for its refund deadline.
       */
      voidEligibleAt?: bigint;
    }
  | { kind: "failed"; reason: string; retryable: boolean };

/**
 * `level`, `message` and `ts` belong to the logger, and `message` is always the
 * event name. Error text goes in `error`, from `describeError`.
 */
export type KeeperLogFields = Record<string, unknown> & {
  level?: never;
  message?: never;
  ts?: never;
};

export type KeeperLogger = {
  info: (message: string, fields?: KeeperLogFields) => void;
  warn: (message: string, fields?: KeeperLogFields) => void;
  error: (message: string, fields?: KeeperLogFields) => void;
};

/** IVRFHub.RequestState, in order. */
export type RequestStateName =
  | "none"
  | "awaiting"
  | "received"
  | "terminal"
  | "cancelled"
  | "voided";
export type RequestRead = { bank: Address; hub: Address; betId: bigint; state: RequestStateName };
