/**
 * JSON shapes of the governance API routes. Calls are decoded on the server with the release ABIs
 * (`decodeGovernanceCall`), so pages render them without contract code.
 */
export type GovernanceContractName =
  | "PoolRegistry"
  | "GameHub"
  | "Bank"
  | "ReferralRegistry"
  | "GovernanceTimelock"
  | "unknown";

export type GovernanceArgValue = string | boolean | GovernanceArgValue[];

export type GovernanceCallView = {
  target: `0x${string}`;
  contract: { name: GovernanceContractName; poolId?: number };
  /** First four bytes of the call data; absent when the data is shorter. */
  selector?: `0x${string}`;
  /** Present only when the target is a release contract and the call decodes with its ABI. */
  function?: {
    name: string;
    signature: string;
    /** uint values as decimal strings, addresses checksummed, bytes as hex. */
    args: { name: string; type: string; value: GovernanceArgValue }[];
  };
  /** grantRole, revokeRole and renounceRole: the TimelockController role name when known. */
  roleName?: string;
};

export type GovernanceOperationState = "waiting" | "ready" | "executed" | "cancelled";

/** One call of a scheduled operation; a batch has one row per call, sharing operationId. */
export type GovernanceOperationView = {
  operationId: `0x${string}`;
  index: number;
  state: GovernanceOperationState;
  /** Unix seconds from which anyone can execute it. */
  readyAt: number;
  /** Schedule block time, unix milliseconds. */
  scheduledAt: number;
  scheduledTxHash: `0x${string}`;
  executedTxHash?: `0x${string}`;
  cancelledTxHash?: `0x${string}`;
  /** Native value sent with the call, wei as a decimal string. */
  value: string;
  call: GovernanceCallView;
};

/** How far the index has read the timelock; a stale index may miss a newer schedule. */
export type GovernanceCoverage = {
  indexedThroughBlock: number | null;
  /** Block time of `indexedThroughBlock`, unix milliseconds. */
  indexedThroughAt: number | null;
  stale: boolean;
};

export type GovernanceQueueResponse = {
  schemaVersion: 1;
  chainId: number;
  generatedAt: number;
  /** "unavailable": the index or the chain could not be read; nothing is known about the queue. */
  source: "postgres" | "unavailable";
  timelock: `0x${string}` | null;
  coverage: GovernanceCoverage;
  operations: GovernanceOperationView[];
};

export type VoidWindowView = {
  poolId: number;
  bank: `0x${string}`;
  /** Unix seconds: bets of this Bank requested at or before it can be voided 24 hours after their request. */
  cohortEnd: number;
  caller: `0x${string}`;
  blockNumber: number;
  /** Unix milliseconds, when indexed. */
  blockTimestamp?: number;
  txHash: `0x${string}`;
};

export type DisabledGameView = {
  gameId: `0x${string}`;
  caller: `0x${string}`;
  blockNumber: number;
  blockTimestamp?: number;
  txHash: `0x${string}`;
};

export type OpsGovernanceResponse = GovernanceQueueResponse & {
  voidWindows: VoidWindowView[];
  disabledGames: DisabledGameView[];
};
