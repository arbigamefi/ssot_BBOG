import type { Address, Hex } from "viem";
import type { BankProviderLedgerPool } from "./bank-provider-ledger.js";

export type BetStateName = "none" | "held" | "pendingVrf" | "randomReady" | "settled" | "refunded";

export type KeeperRole = "primary" | "backup";

export type KeeperEventSource = "gameHub" | "vrfHub" | "scan" | "manual";

export type KeeperEvent = {
  source: KeeperEventSource;
  betId: bigint;
  requestId?: bigint;
  randomHash?: Hex;
  blockNumber?: bigint;
  txHash?: Hex;
  receivedAt: number;
};

export type KeeperConfig = {
  chainId: number;
  gameHub: Address;
  sportsHub?: Address;
  vrfHub: Address;
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
  healthPath?: string;
  betIndexDatabaseUrl?: string;
  betIndexSsl: boolean;
  betIndexWriteEnabled: boolean;
  bankProviderLedgerPools: BankProviderLedgerPool[];
  bankProviderLedgerScanIntervalMs: number;
  sportsTicketIndexEnabled: boolean;
  sportsTerminalizerEnabled: boolean;
  sportsTerminalizerScanChunkBlocks: bigint;
  sportsTerminalizerMarketIds: bigint[];
  sportsTerminalizerMaxTicketsPerMarket: number;
  /** Legacy setting retained for env compatibility; recovery no longer trusts a recent-ID sample. */
  sportsTicketEnumerationMax: number;
  sportsTicketScanChunkBlocks: bigint;
  /** Maximum history blocks per pass; completed chunks resume from a durable cursor. */
  sportsTicketScanMaxBlocks: bigint;
  sportsTicketScanStartBlock: bigint;
};

export type BetRead = {
  betId: bigint;
  requestId: bigint;
  state: BetStateName;
};

export type FinalizeOutcome =
  | { kind: "settled"; txHash: Hex; latencyMs: number }
  | { kind: "raced"; state: BetStateName }
  | { kind: "skipped"; state: BetStateName }
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
