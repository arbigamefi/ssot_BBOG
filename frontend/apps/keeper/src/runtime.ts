import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  defineChain,
  decodeEventLog,
  getAddress,
  getAbiItem,
  type AbiEvent,
  http,
  webSocket,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPostgresBetIndexStore,
  enrichFinalizedBetEvents,
  GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
  readSettledBetRefund,
  type BetIndexEvent,
  type BetRow,
  type BetIndexStore
} from "@ssot/bet-index";

import { decodeHouseEdgeLog } from "@ssot/bet-index/house-edge";
import { GAME_HUB_KEEPER_ABI, VRF_HUB_KEEPER_ABI } from "./abi.js";
import { fetchVaultProviderLedgerRows } from "./vault-provider-ledger.js";
import { describeError } from "./errors.js";
import { finalizeIfReady, retryDelayMs } from "./finalizer.js";
import {
  GAME_HUB_INDEX_EVENTS,
  type GameHubIndexEventName,
  type GameHubLog,
  fetchGameHubLogs
} from "./gamehub-logs.js";
import { UnknownBlockGrace } from "./block-grace.js";
import { fetchGovernanceTimelockEvents, verifyGovernanceTimelock } from "./governance.js";
import { HeadMonitor } from "./head-monitor.js";
import {
  createFileHealthSink,
  KeeperHealthReporter,
  type FinalizedScanHealth,
  type GovernanceHealth
} from "./health.js";
import { FinalizeQueue, type QueueItem } from "./queue.js";
import { isScanTruncated, splitBlockRange, type BlockRange } from "./scan.js";
import { mapBetState, mapRequestState } from "./state.js";
import type { BetRead, FinalizeOutcome, KeeperConfig, KeeperEvent, KeeperLogger } from "./types.js";
import { BANK_KEEPER_ABI } from "./abi.js";
import { readPoolHealth } from "./pools.js";
import { createPayableClaimer } from "./payables.js";
import type { PayableHealth } from "./health.js";
import {
  attemptVoid,
  checkVoidGasLimit,
  compareVoidCandidates,
  VOID_PARAMETER_FUNCTIONS,
  VoidConfigurationError,
  voidEligibleAt,
  type VoidAttemptOutcome,
  type VoidCandidate,
  type VoidParameters
} from "./void.js";

// Stage-2 admission calls GameHub with 3m execution gas. Transactions also pay intrinsic gas
// (21k + 36 calldata bytes); use the same 3.05m envelope for eth_call and the actual transaction.
export const CASINO_TRANSACTION_GAS = 3_050_000n;

type GameHubEventName = BetIndexEvent["eventName"];
const BET_INDEX_CURSOR_SOURCE = "gamehub-events";
const VAULT_PROVIDER_LEDGER_CURSOR_SOURCE = "vault-provider-ledger-finalized";
/** PoolRegistry, GameHub and Bank governance are reread this often while indexing. */
const GOVERNANCE_REVERIFY_MS = 3_600_000;
/** KEEPER_FINALIZED_STALL_SECONDS default. */
const DEFAULT_FINALIZED_STALL_MS = 3_600_000;
const CASINO_RECOVERY_PAGE_SIZE = 50;
/**
 * Indexed-bet recovery re-reads every requeued bet on chain, so after scans it runs
 * about this often however short the poll interval is.
 */
const CASINO_RECOVERY_INTERVAL_MS = 300_000;
const RPC_USAGE_WINDOW_MS = 60_000;
const TRACKED_RPC_METHODS = new Set([
  "getBlock",
  "getBlockNumber",
  "getContractEvents",
  "getLogs",
  "getTransactionReceipt",
  "readContract",
  "simulateContract",
  "waitForTransactionReceipt",
  "writeContract"
]);

function incrementCounter(counter: Record<string, number>, key: string) {
  counter[key] = (counter[key] ?? 0) + 1;
}

function createRpcUsageMeter(now = () => Date.now()) {
  let windowStartedAt = now();
  const total: Record<string, number> = {};
  const totalErrors: Record<string, number> = {};
  let lastMinute: Record<string, number> = {};
  let errorsLastMinute: Record<string, number> = {};

  const rollWindow = () => {
    const current = now();
    if (current - windowStartedAt < RPC_USAGE_WINDOW_MS) return current;
    windowStartedAt = current;
    lastMinute = {};
    errorsLastMinute = {};
    return current;
  };

  return {
    record(method: string, failed = false) {
      rollWindow();
      incrementCounter(total, method);
      incrementCounter(lastMinute, method);
      if (!failed) return;
      incrementCounter(totalErrors, method);
      incrementCounter(errorsLastMinute, method);
    },
    snapshot() {
      const updatedAt = rollWindow();
      return {
        errorsLastMinute: { ...errorsLastMinute },
        lastMinute: { ...lastMinute },
        total: { ...total },
        totalErrors: { ...totalErrors },
        windowStartedAt: new Date(windowStartedAt).toISOString(),
        updatedAt: new Date(updatedAt).toISOString()
      };
    }
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRpcThrottle(minIntervalMs: number, now = () => Date.now()) {
  let lastStartedAt = 0;
  let tail: Promise<void> = Promise.resolve();

  return async function throttle<T>(operation: () => Promise<T>): Promise<T> {
    const run = tail.then(async () => {
      const waitMs = Math.max(0, lastStartedAt + minIntervalMs - now());
      if (waitMs > 0) await delay(waitMs);
      lastStartedAt = now();
      return operation();
    });
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}

function instrumentRpcClient<T extends object>(
  client: T,
  meter: ReturnType<typeof createRpcUsageMeter>,
  throttle?: ReturnType<typeof createRpcThrottle>
): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (
        typeof prop !== "string" ||
        typeof value !== "function" ||
        !TRACKED_RPC_METHODS.has(prop)
      ) {
        return value;
      }
      return (...args: unknown[]) => {
        const invoke = async () => {
          try {
            const result = await Promise.resolve(value.apply(target, args) as unknown);
            meter.record(prop);
            return result;
          } catch (error) {
            meter.record(prop, true);
            throw error;
          }
        };
        return throttle ? throttle(invoke) : invoke();
      };
    }
  }) as T;
}

export function createKeeperChain(config: KeeperConfig) {
  return defineChain({
    id: config.chainId,
    name: `chain-${config.chainId}`,
    nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: {
        http: [config.httpRpcUrl],
        webSocket: config.wsRpcUrl ? [config.wsRpcUrl] : undefined
      }
    }
  });
}

export type KeeperRuntime = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  enqueue: (event: KeeperEvent) => void;
  queue: FinalizeQueue;
  health: KeeperHealthReporter;
};

export function createKeeperRuntime({
  config,
  logger
}: {
  config: KeeperConfig;
  logger: KeeperLogger;
}): KeeperRuntime {
  const chain = createKeeperChain(config);
  const account = privateKeyToAccount(config.privateKey);
  const rpcUsage = createRpcUsageMeter();
  const rpcThrottle =
    config.rpcMinIntervalMs > 0 ? createRpcThrottle(config.rpcMinIntervalMs) : undefined;
  const publicClient = instrumentRpcClient(
    createPublicClient({
      chain,
      transport: http(config.httpRpcUrl)
    }),
    rpcUsage,
    rpcThrottle
  );
  const walletClient = instrumentRpcClient(
    createWalletClient({
      account,
      chain,
      transport: http(config.httpRpcUrl)
    }),
    rpcUsage,
    rpcThrottle
  );
  const wsClient =
    config.wsRpcUrl == null
      ? undefined
      : createPublicClient({
          chain,
          // One runtime supervisor owns reconnects and subscriptions, including initial failures.
          transport: webSocket(config.wsRpcUrl, { reconnect: false })
        });

  const queue = new FinalizeQueue();
  const health = new KeeperHealthReporter({
    config,
    keeper: account.address,
    sink: config.healthPath ? createFileHealthSink(config.healthPath) : undefined
  });
  const timers: Array<ReturnType<typeof setInterval>> = [];
  const unwatchers: Array<() => void> = [];
  let wsRetryTimer: ReturnType<typeof setTimeout> | undefined;
  let closeWebSocket: (() => void) | undefined;
  let resettingWebSocket = false;
  let stopped = false;
  let scanning = false;
  let vaultProviderLedgerScanning = false;
  let lastScannedBlock = config.startBlock ?? 0n;
  // Finalized-head scans start at the release origin, inclusive.
  const finalizedOrigin = (config.casinoRecoveryStartBlock ?? config.startBlock ?? 0n) - 1n;
  const finalizedStallMs = config.finalizedStallMs ?? DEFAULT_FINALIZED_STALL_MS;
  let vaultProviderLedgerLastScannedBlock = finalizedOrigin;
  const vaultProviderLedgerHead = new HeadMonitor({
    scanner: VAULT_PROVIDER_LEDGER_CURSOR_SOURCE,
    head: "finalized",
    logger,
    stallMs: finalizedStallMs
  });
  // Pool and governance reads pinned to a block number may reach a node without that block.
  const blockGrace = new UnknownBlockGrace();
  const gameHubScanHead = new HeadMonitor({
    scanner: BET_INDEX_CURSOR_SOURCE,
    head: "latest",
    logger
  });
  let recoveryAfterBetId = 0n;
  let recoveringIndexedBets = false;
  let drainingQueue = false;
  let lifecycleScanning = false;
  let nextLifecycleScanAt = 0;
  const recoveryOrigin = config.casinoRecoveryStartBlock;
  const banks = new Map(
    config.vaultProviderLedgerPools.map((pool) => [pool.bank.toLowerCase(), pool])
  );
  const payableClaimers = [...banks.values()].map((pool) =>
    createPayableClaimer({
      bank: pool.bank,
      origin: recoveryOrigin,
      chunkSize: config.scanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass,
      logger,
      finalizedStallMs
    })
  );
  /** Received results whose settlement reverts, by bet ID (ADR-0037 §7.3 operating rule 3). */
  const voidCandidates = new Map<string, VoidCandidate>();
  let voidParameters: VoidParameters | undefined;
  let voidPassRunning = false;
  let voidPassRequested = false;
  // After a start no bet is voided until every earlier candidate can be known: lifecycle recovery has
  // reached the head seen at startup and the indexed open bets have been requeued once.
  let startupHead: bigint | undefined;
  let indexedRequeueComplete = false;
  let startupRecoveryComplete = false;
  let waitingForStartupRecoveryLogged = false;
  let governance:
    | {
        verifiedAt: number;
        scannedThrough: bigint;
        head: HeadMonitor;
      }
    | undefined;
  const recoverySource = `casino-open-bets-v1:${recoveryOrigin ?? 0n}`;
  let recoveryScannedThrough = recoveryOrigin == null ? 0n : recoveryOrigin - 1n;
  let writeTail: Promise<unknown> = Promise.resolve();
  const withWriteLock = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = writeTail.then(operation);
    writeTail = result.catch(() => undefined);
    return result;
  };
  // Counting scans rather than elapsed time keeps a 300s poll recovering on every scan.
  const scansPerRecovery =
    config.pollIntervalMs > 0
      ? Math.max(1, Math.ceil(CASINO_RECOVERY_INTERVAL_MS / config.pollIntervalMs))
      : 1;
  let scansSinceRecovery = 0;
  const betIndexStore =
    config.betIndexWriteEnabled && config.betIndexDatabaseUrl
      ? createPostgresBetIndexStore({
          connectionString: config.betIndexDatabaseUrl,
          ssl: config.betIndexSsl
        })
      : undefined;

  // Stop joins operations already in flight before closing the shared store or writing final health.
  const activeOperations = new Set<Promise<unknown>>();
  const trackOperation = <T>(operation: Promise<T>): Promise<T> => {
    activeOperations.add(operation);
    void operation.then(
      () => activeOperations.delete(operation),
      () => activeOperations.delete(operation)
    );
    return operation;
  };

  const writeHealth = (op: Promise<void>) => {
    void trackOperation(op).catch((error) => {
      logger.error("casino.keeper.health_write_failed", { error: describeError(error) });
    });
  };

  const enqueue = (event: KeeperEvent) => {
    queue.enqueue(event, config.role === "backup" ? config.backupDelayMs : 0);
    writeHealth(health.recordEnqueued(event, queue.size));
    logger.info("casino.keeper.enqueued", {
      betId: event.betId.toString(),
      requestId: event.requestId?.toString(),
      source: event.source,
      role: config.role
    });
  };

  const requeueIndexedBets = async () => {
    if (!betIndexStore || stopped || recoveringIndexedBets) return;
    recoveringIndexedBets = true;
    try {
      const ids = await betIndexStore.getUnresolvedBetIds({
        chainId: config.chainId,
        gameHub: config.gameHub,
        afterBetId: recoveryAfterBetId,
        limit: CASINO_RECOVERY_PAGE_SIZE
      });
      for (const betId of ids) {
        if (!queue.has(betId)) enqueue({ source: "scan", betId, receivedAt: Date.now() });
      }
      // Rotate rather than repeatedly selecting a stale/poisoned prefix. Restart
      // intentionally begins at zero; on-chain getBet makes replay idempotent.
      recoveryAfterBetId = ids.length < CASINO_RECOVERY_PAGE_SIZE ? 0n : ids[ids.length - 1]!;
      if (ids.length < CASINO_RECOVERY_PAGE_SIZE && !indexedRequeueComplete) {
        indexedRequeueComplete = true;
        checkStartupRecovery();
      }
    } finally {
      recoveringIndexedBets = false;
    }
  };

  const readBet = async (betId: bigint): Promise<BetRead> => {
    const bet = (await publicClient.readContract({
      address: config.gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "getBet",
      args: [betId]
    })) as unknown as {
      betId: bigint;
      requestId: bigint;
      state: number;
      refundDeadline: bigint;
      bank: Address;
      vrfRequestedAt?: bigint;
    };
    return {
      betId: BigInt(bet.betId),
      requestId: BigInt(bet.requestId),
      state: mapBetState(Number(bet.state)),
      bank: bet.bank,
      refundDeadline: BigInt(bet.refundDeadline),
      ...(bet.vrfRequestedAt == null ? {} : { vrfRequestedAt: BigInt(bet.vrfRequestedAt) })
    };
  };

  const readRequest = async (bet: BetRead) => {
    const request = await readVrfRequest(bet.requestId);
    if (
      request.betId !== bet.betId ||
      getAddress(request.hub) !== getAddress(config.gameHub) ||
      !bet.bank ||
      getAddress(request.bank) !== getAddress(bet.bank)
    ) {
      throw new Error("Canonical VRF request binding does not match Hub position");
    }
    return request;
  };

  const readVrfRequest = async (requestId: bigint) => {
    const request = (await publicClient.readContract({
      address: config.vrfHub,
      abi: VRF_HUB_KEEPER_ABI,
      functionName: "getRequest",
      args: [requestId]
    })) as { bank: Address; hub: Address; betId: bigint; state: number };
    return {
      bank: request.bank,
      hub: request.hub,
      betId: request.betId,
      state: mapRequestState(Number(request.state))
    };
  };

  const simulateFinalize = async (betId: bigint) => {
    await publicClient.simulateContract({
      account: account.address,
      address: config.gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "finalize",
      args: [betId],
      gas: CASINO_TRANSACTION_GAS
    });
  };

  const writeFinalize = async (betId: bigint) =>
    walletClient.writeContract({
      account,
      address: config.gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "finalize",
      args: [betId],
      gas: CASINO_TRANSACTION_GAS,
      chain
    });

  const readRefundClock = async () => {
    const block = await publicClient.getBlock();
    return { timestamp: block.timestamp };
  };
  const simulateRefund = async (betId: bigint) => {
    await publicClient.simulateContract({
      account: account.address,
      address: config.gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "refund",
      args: [betId],
      gas: CASINO_TRANSACTION_GAS
    });
  };
  const writeRefund = async (betId: bigint) =>
    walletClient.writeContract({
      account,
      chain,
      address: config.gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "refund",
      args: [betId],
      gas: CASINO_TRANSACTION_GAS
    });

  const waitFinalizeReceipt = async (txHash: Hex) => {
    const receipt = await publicClient.waitForTransactionReceipt({
      checkReplacement: false,
      hash: txHash,
      pollingInterval: 1_000
    });
    return { status: receipt.status, blockNumber: receipt.blockNumber };
  };

  const materializeCasinoReceipt = async (event: KeeperEvent, txHash: Hex) => {
    if (!betIndexStore) return;
    const { row, houseEdge } = await buildTerminalBetRow({
      betId: event.betId,
      chainId: config.chainId,
      gameHub: config.gameHub,
      publicClient,
      txHash
    });
    await betIndexStore.writeBetRows([row]);
    if (houseEdge) await betIndexStore.writeGameHubEvents([houseEdge]);
    logger.info("casino.keeper.receipt_materialized", {
      betId: event.betId.toString(),
      eventName: row.lastEventName,
      txHash
    });
  };

  // ---------------------------------------------------------------------------------------------
  // Void executor: the operator's keeper attempts every eligible bet in VRF request order, in
  // consecutive blocks, and publishes the results (ADR-0037 §7.3 operating rule 3).
  // ---------------------------------------------------------------------------------------------

  const readVoidParameters = async (): Promise<VoidParameters> => {
    const entries = await Promise.all(
      (Object.entries(VOID_PARAMETER_FUNCTIONS) as Array<[keyof VoidParameters, string]>).map(
        async ([key, functionName]) => {
          const value = await publicClient.readContract({
            address: config.gameHub,
            abi: GAME_HUB_KEEPER_ABI,
            functionName
          });
          if (typeof value !== "bigint") throw new Error(`GameHub ${functionName} is unreadable`);
          return [key, value] as const;
        }
      )
    );
    return Object.fromEntries(entries) as VoidParameters;
  };

  /** Reads the GameHub void constants once and checks KEEPER_VOID_GAS_LIMIT against them. */
  const requireVoidParameters = async () => {
    if (voidParameters) return voidParameters;
    const parameters = await readVoidParameters();
    checkVoidGasLimit(config.voidGasLimit, parameters);
    voidParameters = parameters;
    logger.info("casino.void.parameters", {
      voidDelay: parameters.voidDelay.toString(),
      publicVoidDelay: parameters.publicVoidDelay.toString(),
      settlementGas: parameters.settlementGas.toString(),
      reserveGas: parameters.reserveGas.toString(),
      callOverhead: parameters.callOverhead.toString(),
      gasLimit: config.voidGasLimit.toString()
    });
    return parameters;
  };

  const readVoidCohortEnd = async (bank: Address) =>
    BigInt(
      (await publicClient.readContract({
        address: config.gameHub,
        abi: GAME_HUB_KEEPER_ABI,
        functionName: "voidCohortEnd",
        args: [bank]
      })) as bigint
    );

  const publishVoidCandidates = (chainTime?: bigint) =>
    writeHealth(
      health.recordVoidCandidates(
        [...voidCandidates.values()].sort(compareVoidCandidates).map((candidate) => ({
          betId: candidate.betId.toString(),
          bank: candidate.bank,
          vrfRequestedAt: candidate.vrfRequestedAt.toString(),
          receivedAt: candidate.receivedAt.toString(),
          receivedFrom: candidate.receivedFrom,
          eligibleAt: candidate.eligibleAt.toString(),
          // Time only moves forward and a void window only moves eligibility earlier.
          eligible: candidate.eligibleSeenAt != null,
          reason: candidate.reason
        })),
        queue.size,
        chainTime
      )
    );

  /**
   * When the result was received: the block of the ResultReceived or BetRandomReady event that queued
   * the bet. Without one, the VRF request time stands in; it can only make the age larger.
   */
  const resolveReceivedAt = async (
    previous: VoidCandidate | undefined,
    event: KeeperEvent | undefined,
    vrfRequestedAt: bigint
  ): Promise<Pick<VoidCandidate, "receivedAt" | "receivedFrom">> => {
    if (previous?.receivedFrom === "result") return previous;
    if (event?.resultBlockNumber != null) {
      try {
        const block = await publicClient.getBlock({ blockNumber: event.resultBlockNumber });
        return { receivedAt: block.timestamp, receivedFrom: "result" };
      } catch {
        // The request time stands in until a later check reads the block.
      }
    }
    return { receivedAt: vrfRequestedAt, receivedFrom: "request" };
  };

  const closeVoidCandidate = (betId: bigint) => {
    if (!voidCandidates.delete(betId.toString())) return;
    publishVoidCandidates();
    writeHealth(health.recordVoidCandidateClosed(betId, queue.size));
  };

  /**
   * finalizeIfReady found that the settlement of a received result reverts. The bet becomes (or stays)
   * a void candidate; the answer tells the queue when voidBet becomes allowed.
   */
  const assessVoid = async (bet: BetRead, reason: string, event?: KeeperEvent) => {
    const parameters = await requireVoidParameters();
    if (bet.vrfRequestedAt == null || !bet.bank)
      throw new Error("Void eligibility needs the bet's Bank and VRF request time");
    const [cohortEnd, clock] = await Promise.all([readVoidCohortEnd(bet.bank), readRefundClock()]);
    const eligibleAt = voidEligibleAt(bet.vrfRequestedAt, cohortEnd, parameters);
    const eligible = eligibleAt <= clock.timestamp;
    const key = bet.betId.toString();
    const previous = voidCandidates.get(key);
    const received = await resolveReceivedAt(previous, event, bet.vrfRequestedAt);
    const changed =
      !previous ||
      previous.eligibleAt !== eligibleAt ||
      (eligible && previous.eligibleSeenAt == null);
    // Updated in place: a void pass may hold this candidate while the queue rechecks the bet.
    const candidate: VoidCandidate = previous ?? {
      betId: bet.betId,
      bank: bet.bank,
      vrfRequestedAt: bet.vrfRequestedAt,
      eligibleAt,
      reason,
      ...received
    };
    Object.assign(candidate, {
      bank: bet.bank,
      vrfRequestedAt: bet.vrfRequestedAt,
      eligibleAt,
      reason,
      receivedAt: received.receivedAt,
      receivedFrom: received.receivedFrom
    });
    if (eligible) candidate.eligibleSeenAt ??= Date.now();
    voidCandidates.set(key, candidate);
    if (changed)
      logger.warn("casino.void.candidate", {
        betId: key,
        bank: bet.bank,
        vrfRequestedAt: bet.vrfRequestedAt.toString(),
        eligibleAt: eligibleAt.toString(),
        chainTime: clock.timestamp.toString(),
        receivedAt: candidate.receivedAt.toString(),
        receivedFrom: candidate.receivedFrom,
        eligible,
        reason
      });
    publishVoidCandidates(clock.timestamp);
    if (eligible) requestVoidPass();
    return { eligibleAt, chainTime: clock.timestamp };
  };

  /** A queue outcome other than an unbookable deferral shows the bet left the void executor. */
  const syncVoidCandidate = (betId: bigint, outcome: FinalizeOutcome) => {
    if (outcome.kind === "failed") return;
    if (outcome.kind === "deferred" && outcome.voidEligibleAt != null) return;
    closeVoidCandidate(betId);
  };

  const voidAttemptDeps = {
    gameHub: config.gameHub,
    gasLimit: config.voidGasLimit,
    readBet,
    readRequest,
    simulateFinalize,
    simulateVoid: async (betId: bigint) => {
      const { result } = await publicClient.simulateContract({
        account: account.address,
        address: config.gameHub,
        abi: GAME_HUB_KEEPER_ABI,
        functionName: "voidBet",
        args: [betId],
        gas: config.voidGasLimit
      });
      return result === true;
    },
    writeVoid: async (betId: bigint) =>
      walletClient.writeContract({
        account,
        chain,
        address: config.gameHub,
        abi: GAME_HUB_KEEPER_ABI,
        functionName: "voidBet",
        args: [betId],
        gas: config.voidGasLimit
      }),
    waitVoidReceipt: async (txHash: Hex) => {
      const receipt = await publicClient.waitForTransactionReceipt({
        checkReplacement: false,
        hash: txHash,
        pollingInterval: 1_000
      });
      return { status: receipt.status, logs: receipt.logs };
    },
    materializeReceipt: (betId: bigint, txHash: Hex) =>
      materializeCasinoReceipt({ source: "void", betId, receivedAt: Date.now() }, txHash),
    logger
  };

  const handleVoidOutcome = (candidate: VoidCandidate, outcome: VoidAttemptOutcome) => {
    const betId = candidate.betId.toString();
    if (outcome.kind === "notEligible") {
      candidate.eligibleAt = outcome.eligibleAt;
      candidate.eligibleSeenAt = undefined;
    } else if (outcome.kind === "failed") {
      logger.error("casino.void.failed", { betId, error: outcome.reason, txHash: outcome.txHash });
    } else if (outcome.kind === "configurationError") {
      logger.error("casino.void.configuration_error", { betId, error: outcome.reason });
    } else {
      voidCandidates.delete(betId);
      if (outcome.kind === "bookable") logger.info("casino.void.bookable", { betId });
      if (outcome.kind === "dropped")
        logger.info("casino.void.dropped", { betId, reason: outcome.reason });
      // Reconcile the queued bet now: it is terminal, or back on the normal finalize path.
      enqueue({ source: "void", betId: candidate.betId, receivedAt: Date.now() });
    }
    writeHealth(health.recordVoidOutcome(candidate.betId, outcome, queue.size));
    publishVoidCandidates();
  };

  const voidEligibleCandidates = async () => {
    if (voidCandidates.size === 0) return;
    const parameters = await requireVoidParameters();
    const { timestamp: chainTime } = await readRefundClock();
    // One read per Bank: a void window moves the eligibility of its whole cohort.
    const cohortEnds = new Map<string, bigint>();
    for (const candidate of voidCandidates.values()) {
      const bank = candidate.bank.toLowerCase();
      let cohortEnd = cohortEnds.get(bank);
      if (cohortEnd == null) {
        cohortEnd = await readVoidCohortEnd(candidate.bank);
        cohortEnds.set(bank, cohortEnd);
      }
      candidate.eligibleAt = voidEligibleAt(candidate.vrfRequestedAt, cohortEnd, parameters);
      if (candidate.eligibleAt <= chainTime) candidate.eligibleSeenAt ??= Date.now();
    }
    publishVoidCandidates(chainTime);
    if (!checkStartupRecovery()) {
      if (!waitingForStartupRecoveryLogged)
        logger.info("casino.void.waiting_for_startup_recovery", {
          recoveryScannedThrough: recoveryScannedThrough.toString(),
          startupHead: startupHead?.toString(),
          indexedRequeueComplete
        });
      waitingForStartupRecoveryLogged = true;
      return;
    }
    const eligible = [...voidCandidates.values()]
      .filter((candidate) => candidate.eligibleAt <= chainTime)
      .sort(compareVoidCandidates);
    for (const { betId } of eligible) {
      if (stopped) return;
      const attempt = await withWriteLock(async () => {
        // The queue may have closed the candidate, or updated it, while this pass waited.
        const candidate = voidCandidates.get(betId.toString());
        if (stopped || !candidate) return null;
        // A backup leaves each newly eligible bet to the primary for its configured delay.
        if (
          config.role === "backup" &&
          Date.now() - (candidate.eligibleSeenAt ?? Date.now()) < config.backupDelayMs
        )
          return undefined;
        // Bet IDs follow VRF request time: a lower bet never examined may belong first.
        if (queue.hasUnexaminedBefore(betId)) return undefined;
        return { candidate, outcome: await attemptVoid(candidate, voidAttemptDeps) };
      });
      if (attempt === undefined) return;
      if (attempt === null) continue;
      handleVoidOutcome(attempt.candidate, attempt.outcome);
      if (attempt.outcome.kind === "configurationError") return;
    }
  };

  const runVoidPass = async () => {
    voidPassRunning = true;
    try {
      while (voidPassRequested && !stopped) {
        voidPassRequested = false;
        try {
          await voidEligibleCandidates();
          writeHealth(health.recordVoidPass(undefined, queue.size));
        } catch (error) {
          const description = describeError(error);
          logger.error("casino.void.pass_failed", { error: description });
          writeHealth(health.recordVoidPass(description, queue.size));
        }
      }
    } finally {
      voidPassRunning = false;
    }
  };

  function requestVoidPass() {
    voidPassRequested = true;
    if (voidPassRunning || stopped) return;
    void trackOperation(runVoidPass());
  }

  /**
   * ADR-0037 §7.3 rule 3 orders voids by VRF request time, which only holds once every earlier
   * candidate is known. After a start, lifecycle recovery must reach the head it saw first and the
   * indexed open bets must have been requeued once. Latches; wakes the void executor when reached.
   */
  function checkStartupRecovery() {
    if (startupRecoveryComplete) return true;
    const history =
      recoveryOrigin == null || (startupHead != null && recoveryScannedThrough >= startupHead);
    if (!history || (betIndexStore && !indexedRequeueComplete)) return false;
    startupRecoveryComplete = true;
    logger.info("casino.void.startup_recovery_complete", {
      recoveryScannedThrough: recoveryScannedThrough.toString(),
      startupHead: startupHead?.toString()
    });
    writeHealth(health.recordVoidStartupRecovery(true, queue.size));
    if (voidCandidates.size > 0) requestVoidPass();
    return true;
  }

  const processItem = async (item: QueueItem) => {
    if (stopped) {
      queue.complete(item.betId);
      return;
    }
    try {
      const outcome = await finalizeIfReady(item, {
        readBet,
        readRequest,
        simulateFinalize,
        writeFinalize,
        readRefundClock,
        simulateRefund,
        writeRefund,
        waitFinalizeReceipt,
        materializeReceipt: materializeCasinoReceipt,
        assessVoid,
        logger
      });
      syncVoidCandidate(item.betId, outcome);

      if (outcome.kind === "deferred") {
        queue.retry(item, outcome.retryAfterMs);
        writeHealth(health.recordFinalizeOutcome(item, outcome, queue.size));
        return;
      }
      if (outcome.kind === "failed" && outcome.retryable) {
        const next = queue.retry(item, retryDelayMs(item.attempts));
        writeHealth(health.recordFinalizeOutcome(item, outcome, queue.size));
        logger.warn("casino.keeper.retry_scheduled", {
          betId: item.betId.toString(),
          attempts: next.attempts,
          reason: outcome.reason
        });
        return;
      }

      queue.complete(item.betId);
      writeHealth(health.recordFinalizeOutcome(item, outcome, queue.size));
    } catch (error) {
      queue.retry(item, retryDelayMs(item.attempts));
      const description = describeError(error);
      logger.error("casino.keeper.process_failed", {
        betId: item.betId.toString(),
        error: description
      });
      writeHealth(
        health.recordFinalizeOutcome(
          item,
          { kind: "failed", reason: description, retryable: true },
          queue.size
        )
      );
    }
  };

  const drainQueue = async () => {
    if (stopped || drainingQueue) return;
    drainingQueue = true;
    try {
      for (;;) {
        if (stopped) return;
        const item = queue.nextReady();
        if (!item) return;
        await withWriteLock(() => processItem(item));
      }
    } finally {
      drainingQueue = false;
    }
  };

  const enqueueBetRandomReadyLog = (log: {
    args?: { positionId?: bigint; requestId?: bigint; randomHash?: Hex };
    blockNumber?: bigint;
    transactionHash?: Hex;
  }) => {
    const betId = log.args?.positionId;
    if (betId == null) return;
    enqueue({
      source: "gameHub",
      betId,
      requestId: log.args?.requestId,
      randomHash: log.args?.randomHash,
      blockNumber: log.blockNumber,
      resultBlockNumber: log.blockNumber,
      txHash: log.transactionHash,
      receivedAt: Date.now()
    });
    void trackOperation(drainQueue()).catch((error) => {
      logger.error("casino.keeper.ready_drain_failed", { error: describeError(error) });
    });
  };

  const writeBetIndexLogs = async (
    eventName: GameHubEventName,
    logs: Array<{
      args?: Record<string, unknown>;
      blockNumber?: bigint;
      blockTimestamp?: bigint | number;
      logIndex?: number;
      transactionHash?: Hex;
    }>
  ) => {
    if (!betIndexStore || logs.length === 0) return;
    const stampedLogs = await attachBlockTimestamps(publicClient, logs);
    const events = stampedLogs
      .map((log) => toBetIndexEvent(config.chainId, config.gameHub, eventName, log))
      .filter((event): event is BetIndexEvent => Boolean(event));
    if (events.length === 0) return;
    try {
      await betIndexStore.writeGameHubEvents(await enrichFinalizedBetEvents(publicClient, events));
    } catch (error) {
      logger.error("casino.keeper.bet_index_write_failed", {
        eventName,
        error: describeError(error)
      });
      throw error;
    }
  };

  const initializeBetIndex = async () => {
    if (!betIndexStore) return;
    try {
      await betIndexStore.initializeSchema();
      logger.info("casino.keeper.bet_index_ready");
      const cursor = await betIndexStore.getCursor(
        config.chainId,
        BET_INDEX_CURSOR_SOURCE,
        config.gameHub
      );
      const resumeBlock = resolveBetIndexResumeBlock(lastScannedBlock, cursor);
      const bankProviderCursor = await betIndexStore.getCursor(
        config.chainId,
        VAULT_PROVIDER_LEDGER_CURSOR_SOURCE,
        config.gameHub
      );
      if (resumeBlock > lastScannedBlock) {
        const configuredStartBlock = lastScannedBlock;
        lastScannedBlock = resumeBlock;
        logger.info("casino.keeper.bet_index_cursor_resumed", {
          configuredStartBlock: configuredStartBlock.toString(),
          cursorBlock: resumeBlock.toString()
        });
        writeHealth(health.recordStarted(lastScannedBlock, queue.size));
      }
      if (bankProviderCursor != null && bankProviderCursor > vaultProviderLedgerLastScannedBlock) {
        const configuredStartBlock = vaultProviderLedgerLastScannedBlock;
        vaultProviderLedgerLastScannedBlock = bankProviderCursor;
        // The cursor was finalized when written, so a later read below it is a lagging RPC node.
        vaultProviderLedgerHead.seed(bankProviderCursor);
        logger.info("casino.keeper.vault_provider_ledger_cursor_resumed", {
          configuredStartBlock: configuredStartBlock.toString(),
          cursorBlock: bankProviderCursor.toString()
        });
      }
      await requeueIndexedBets();
      if (recoveryOrigin != null) {
        const recoveryCursor = await betIndexStore.getCursor(
          config.chainId,
          recoverySource,
          config.gameHub
        );
        if (recoveryCursor != null && recoveryCursor > recoveryScannedThrough)
          recoveryScannedThrough = recoveryCursor;
      }
    } catch (error) {
      logger.error("casino.keeper.bet_index_schema_initialize_failed", {
        error: describeError(error)
      });
    }
  };

  // Receipt events survive a failed entire Hub delivery. Resolve request identity on
  // the canonical consumer; one consumer may serve other pools and Hubs.
  const enqueueVrfLog = async (log: {
    eventName?: string;
    args?: { requestId?: bigint };
    blockNumber?: bigint;
    transactionHash?: Hex;
  }) => {
    const requestId = log.args?.requestId;
    if (requestId == null || stopped) return;
    const request = await readVrfRequest(requestId);
    if (getAddress(request.hub) !== getAddress(config.gameHub) || request.state !== "received")
      return;
    enqueue({
      source: "vrfHub",
      betId: request.betId,
      requestId,
      blockNumber: log.blockNumber,
      // A later CallbackAttempt can be a retry; only ResultReceived dates the receipt.
      ...(log.eventName === "ResultReceived" ? { resultBlockNumber: log.blockNumber } : {}),
      txHash: log.transactionHash,
      receivedAt: Date.now()
    });
  };
  const vrfRecoveryEvents = ["ResultReceived", "CallbackAttempt"].map(
    (name) => getAbiItem({ abi: VRF_HUB_KEEPER_ABI, name }) as AbiEvent
  );
  const scanVrfResults = async (range: BlockRange) => {
    const logs = await publicClient.getLogs({
      address: config.vrfHub,
      events: vrfRecoveryEvents,
      ...range
    });
    for (const log of logs)
      await enqueueVrfLog(log as unknown as Parameters<typeof enqueueVrfLog>[0]);
  };

  /**
   * A capped pass leaves the cursor short of its target and resumes next tick.
   * Without this line an operator watching a quiet log has no way to tell a
   * caught-up keeper from one still grinding through a months-old backlog.
   */
  const reportScanCap = (scanner: string, ranges: BlockRange[], target: bigint) => {
    if (!isScanTruncated(ranges, target)) return;
    const last = ranges[ranges.length - 1]!;
    logger.info("casino.keeper.scan_capped", {
      scanner,
      chunks: ranges.length,
      scannedThrough: last.toBlock.toString(),
      targetBlock: target.toString(),
      remainingBlocks: (target - last.toBlock).toString()
    });
  };

  const scanMissedEvents = async () => {
    const latest = await publicClient.getBlockNumber();
    // A lagging RPC node can report a latest block below the cursor: scan nothing and say so.
    gameHubScanHead.seed(lastScannedBlock);
    writeHealth(health.recordScanHeadBehind(gameHubScanHead.observe(latest).behindBy, queue.size));
    if (latest <= lastScannedBlock) return;

    const fromBlock = lastScannedBlock === 0n ? latest : lastScannedBlock + 1n;
    const ranges = splitBlockRange({
      fromBlock,
      toBlock: latest,
      chunkSize: config.scanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass
    });
    reportScanCap("gamehub-events", ranges, latest);
    // One eth_getLogs per range serves both finalization and the bet index.
    const indexing = config.scanIndexEventsEnabled && betIndexStore !== undefined;
    for (const range of ranges) {
      const logsByEvent = await fetchGameHubLogs(
        publicClient,
        config.gameHub,
        indexing ? GAME_HUB_INDEX_EVENTS : ["BetPlaced", "BetRandomReady"],
        range
      );
      await scanVrfResults(range);
      const readyLogs = logsByEvent.get("BetRandomReady") ?? [];
      for (const log of logsByEvent.get("BetPlaced") ?? []) {
        const betId = log.args?.positionId ?? log.args?.betId;
        if (betId != null)
          enqueue({ source: "scan", betId: BigInt(betId as bigint), receivedAt: Date.now() });
      }
      for (const log of readyLogs) {
        const args = log.args as
          | { positionId?: bigint; requestId?: bigint; randomHash?: Hex }
          | undefined;
        if (args?.positionId == null) continue;
        enqueue({
          source: "scan",
          betId: BigInt(args.positionId),
          requestId: args.requestId == null ? undefined : BigInt(args.requestId),
          randomHash: args.randomHash,
          blockNumber: log.blockNumber,
          resultBlockNumber: log.blockNumber,
          txHash: log.transactionHash,
          receivedAt: Date.now()
        });
      }
      if (config.scanIndexEventsEnabled) {
        await writeBetIndexRange(betIndexStore, publicClient, config, range, logsByEvent, logger);
      } else {
        await writeBetIndexLogs("BetPlaced", logsByEvent.get("BetPlaced") ?? []);
        await writeBetIndexLogs("BetRandomReady", readyLogs);
        if (betIndexStore) {
          await betIndexStore.setCursor({
            blockNumber: range.toBlock,
            chainId: config.chainId,
            cursorKey: config.gameHub,
            source: BET_INDEX_CURSOR_SOURCE
          });
        }
      }
      lastScannedBlock = range.toBlock;
      writeHealth(health.recordScan(lastScannedBlock, latest, queue.size));
    }
    if (lastScannedBlock < latest)
      writeHealth(health.recordScanBehind(latest - lastScannedBlock, latest, queue.size));
  };

  const scanVaultProviderLedgerEvents = async (): Promise<FinalizedScanHealth | undefined> => {
    if (
      !betIndexStore ||
      config.vaultProviderLedgerPools.length === 0 ||
      config.vaultProviderLedgerScanIntervalMs <= 0
    ) {
      return undefined;
    }
    const finalized = await publicClient.getBlock({ blockTag: "finalized" });
    if (finalized.number == null)
      throw new Error("Bank provider ledger requires a numbered finalized block");
    // A read below the cursor yields no range: nothing is scanned until the RPC catches up.
    const head = vaultProviderLedgerHead.observe(finalized.number);
    const ranges = splitBlockRange({
      fromBlock: vaultProviderLedgerLastScannedBlock + 1n,
      toBlock: head.target,
      chunkSize: config.scanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass
    });
    reportScanCap("vault-provider-ledger", ranges, head.target);
    for (const range of ranges) {
      await writeVaultProviderLedgerRange(betIndexStore, publicClient, config, range, logger);
      vaultProviderLedgerLastScannedBlock = range.toBlock;
    }
    return {
      scannedThrough: vaultProviderLedgerLastScannedBlock.toString(),
      finalizedBlock: head.target.toString(),
      ...(head.behindBy == null ? {} : { finalizedBehindBy: head.behindBy.toString() }),
      ...(head.stalledSince == null
        ? {}
        : { finalizedStalledSince: new Date(head.stalledSince).toISOString() })
    };
  };

  /**
   * Indexes the release GovernanceTimelock through finalized blocks from the release origin, so LPs can
   * read queued admissions during the delay. PoolRegistry, GameHub and every release Bank must report it
   * as their governance; that is rechecked every GOVERNANCE_REVERIFY_MS.
   */
  const scanGovernanceTimelock = async (): Promise<GovernanceHealth | undefined> => {
    if (!betIndexStore || !config.poolRegistry || !config.governanceTimelock) return undefined;
    const timelock = getAddress(config.governanceTimelock);
    if (!governance || Date.now() - governance.verifiedAt >= GOVERNANCE_REVERIFY_MS) {
      try {
        await verifyGovernanceTimelock({
          client: publicClient,
          timelock,
          poolRegistry: config.poolRegistry,
          gameHub: config.gameHub,
          banks: config.releaseBanks ?? [...banks.values()].map((pool) => pool.bank)
        });
      } catch (error) {
        governance = undefined;
        throw error;
      }
      if (governance) governance.verifiedAt = Date.now();
      else {
        const cursor = await betIndexStore.getCursor(
          config.chainId,
          GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
          timelock
        );
        const head = new HeadMonitor({
          scanner: GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
          head: "finalized",
          logger,
          stallMs: finalizedStallMs
        });
        if (cursor != null) head.seed(cursor);
        governance = {
          verifiedAt: Date.now(),
          scannedThrough: cursor != null && cursor > finalizedOrigin ? cursor : finalizedOrigin,
          head
        };
        logger.info("casino.keeper.governance_timelock_verified", {
          timelock,
          poolRegistry: config.poolRegistry,
          scannedThrough: governance.scannedThrough.toString()
        });
      }
    }
    const state = governance;
    const finalized = await publicClient.getBlock({ blockTag: "finalized" });
    if (finalized.number == null)
      throw new Error("Governance timelock indexing requires a numbered finalized block");
    const head = state.head.observe(finalized.number);
    const ranges = splitBlockRange({
      fromBlock: state.scannedThrough + 1n,
      toBlock: head.target,
      chunkSize: config.scanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass
    });
    reportScanCap(GOVERNANCE_TIMELOCK_CURSOR_SOURCE, ranges, head.target);
    for (const range of ranges) {
      const events = await fetchGovernanceTimelockEvents({
        client: publicClient,
        chainId: config.chainId,
        timelock,
        range
      });
      // Rows are persisted before the cursor advances; a failed range is retried whole.
      await betIndexStore.writeGovernanceTimelockEvents(events);
      await betIndexStore.setCursor({
        chainId: config.chainId,
        source: GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
        cursorKey: timelock,
        blockNumber: range.toBlock
      });
      state.scannedThrough = range.toBlock;
    }
    return {
      timelock,
      scannedThrough: state.scannedThrough.toString(),
      finalizedBlock: head.target.toString(),
      ...(head.behindBy == null ? {} : { finalizedBehindBy: head.behindBy.toString() }),
      ...(head.stalledSince == null
        ? {}
        : { finalizedStalledSince: new Date(head.stalledSince).toISOString() }),
      caughtUp: state.scannedThrough >= head.target
    };
  };

  const scanUnresolvedHistory = async () => {
    if (recoveryOrigin == null) return;
    const latest = await publicClient.getBlockNumber();
    startupHead ??= latest;
    const ranges = splitBlockRange({
      fromBlock: recoveryScannedThrough + 1n,
      toBlock: latest,
      chunkSize: config.scanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass
    });
    reportScanCap(recoverySource, ranges, latest);
    for (const range of ranges) {
      const logs = await fetchGameHubLogs(
        publicClient,
        config.gameHub,
        GAME_HUB_INDEX_EVENTS,
        range
      );
      for (const eventName of ["BetPlaced", "BetRandomReady"] as const) {
        for (const log of logs.get(eventName) ?? []) {
          const betId = log.args?.positionId ?? log.args?.betId;
          if (betId != null && !queue.has(BigInt(betId as bigint)))
            enqueue({
              source: "scan",
              betId: BigInt(betId as bigint),
              receivedAt: Date.now(),
              blockNumber: log.blockNumber,
              ...(eventName === "BetRandomReady" ? { resultBlockNumber: log.blockNumber } : {})
            });
        }
      }
      // Persist discovered work before the independent cursor. Without a DB this cursor is deliberately
      // memory-only: restarting replays the complete release history, never an old ready-only checkpoint.
      for (const eventName of GAME_HUB_INDEX_EVENTS)
        await writeBetIndexLogs(eventName, logs.get(eventName) ?? []);
      if (betIndexStore)
        await betIndexStore.setCursor({
          chainId: config.chainId,
          cursorKey: config.gameHub,
          source: recoverySource,
          blockNumber: range.toBlock
        });
      recoveryScannedThrough = range.toBlock;
    }
    await health.recordRecoveryScan(
      recoveryScannedThrough,
      queue.size,
      recoveryScannedThrough >= latest
    );
    checkStartupRecovery();
  };

  // claimPlayerPayable pays only the player, so the keeper needs no authority to complete a deferred payout.
  const claimPlayerPayable = (bank: Address, player: Address) =>
    withWriteLock(async () => {
      if (stopped) throw new Error("Keeper stopped before a payable claim");
      const request = {
        address: bank,
        abi: BANK_KEEPER_ABI,
        functionName: "claimPlayerPayable" as const,
        args: [player] as const
      };
      try {
        await publicClient.simulateContract({ ...request, account: account.address });
      } catch (error) {
        const reverted =
          error instanceof BaseError
            ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
            : undefined;
        const token =
          reverted instanceof ContractFunctionRevertedError ? reverted.data?.args?.[0] : undefined;
        if (
          reverted instanceof ContractFunctionRevertedError &&
          reverted.data?.errorName === "SafeERC20FailedOperation" &&
          typeof token === "string" &&
          token.toLowerCase() === banks.get(bank.toLowerCase())?.asset.toLowerCase()
        )
          return { status: "refused" as const, reason: describeError(error) };
        throw error;
      }
      const txHash = await walletClient.writeContract({ ...request, account, chain });
      const receipt = await waitFinalizeReceipt(txHash);
      logger.info("casino.keeper.player_payable_claimed", {
        bank,
        player,
        txHash,
        status: receipt.status
      });
      return { ...receipt, txHash };
    });

  const runLifecycleScan = async () => {
    if (stopped || lifecycleScanning || Date.now() < nextLifecycleScanAt) return;
    lifecycleScanning = true;
    nextLifecycleScanAt = Date.now() + Math.min(config.pollIntervalMs || 60_000, 60_000);
    try {
      try {
        await scanUnresolvedHistory();
      } catch (error) {
        const description = describeError(error);
        logger.error("casino.keeper.lifecycle_recovery_failed", { error: description });
        await health.recordError(description, queue.size, "recovery");
      }
      const states = await Promise.all(
        [...banks.values()].map((pool) => readPoolHealth(pool, publicClient, blockGrace))
      );
      await health.recordPools(states, queue.size);
      const payables: PayableHealth[] = [];
      for (const claimer of payableClaimers)
        payables.push(await claimer.run(publicClient, claimPlayerPayable));
      await health.recordPayables(payables, queue.size);
      try {
        const progress = await scanGovernanceTimelock();
        blockGrace.succeed("governance");
        if (progress) await health.recordGovernanceScan(progress, queue.size);
      } catch (error) {
        const description = describeError(error);
        if (blockGrace.report("governance", error)) {
          logger.error("casino.keeper.governance_scan_failed", { error: description });
          await health.recordError(description, queue.size, "governance");
        } else logger.warn("casino.keeper.governance_scan_transient", { error: description });
      }
    } catch (error) {
      await health.recordError(describeError(error), queue.size, "pools");
    } finally {
      lifecycleScanning = false;
    }
  };

  const runScan = async () => {
    if (stopped || scanning) return;
    scanning = true;
    try {
      try {
        await scanMissedEvents();
      } finally {
        scansSinceRecovery += 1;
        if (scansSinceRecovery >= scansPerRecovery) {
          scansSinceRecovery = 0;
          await requeueIndexedBets();
        }
      }
    } catch (error) {
      const description = describeError(error);
      logger.error("casino.keeper.scan_failed", { error: description });
      writeHealth(health.recordError(description, queue.size, "scan"));
    } finally {
      scanning = false;
    }
  };

  const runVaultProviderLedgerScan = async () => {
    if (stopped || vaultProviderLedgerScanning) return;
    vaultProviderLedgerScanning = true;
    try {
      const progress = await scanVaultProviderLedgerEvents();
      writeHealth(health.recordLedgerScan(queue.size, progress));
    } catch (error) {
      const description = describeError(error);
      logger.error("casino.keeper.vault_provider_ledger_scan_failed", { error: description });
      writeHealth(health.recordError(description, queue.size, "ledger"));
    } finally {
      vaultProviderLedgerScanning = false;
    }
  };

  /**
   * viem hands a watcher the raw socket error. Node's WebSocket reports a refused, rejected
   * (HTTP 401/429) or dropped connection as an ErrorEvent whose message is empty, and viem's
   * own socket errors put the RPC URL in theirs, so neither is logged as-is.
   */
  const stopWebSocketWatchers = () => {
    resettingWebSocket = true;
    try {
      for (const unwatch of unwatchers.splice(0)) unwatch();
      const close = closeWebSocket;
      closeWebSocket = undefined;
      close?.();
    } finally {
      resettingWebSocket = false;
    }
  };

  const logWatchError = (event: string, error: unknown, eventName?: string) => {
    logger.error(event, { eventName, transport: "websocket", error: describeError(error) });
    if (stopped || resettingWebSocket || wsRetryTimer != null) return;
    // One bounded timer for all watchers. Closing the old socket also discards
    // failed subscriptions before the next attempt; HTTP catch-up stays live.
    wsRetryTimer = setTimeout(() => {
      stopWebSocketWatchers();
      wsRetryTimer = undefined;
      void startWebSocketWatchers();
    }, 2_000);
  };

  const startWebSocketWatchers = async () => {
    if (!wsClient || stopped) return;
    try {
      const rpcClient = await wsClient.transport.getRpcClient();
      if (stopped) {
        rpcClient.close();
        return;
      }
      const onClose = () =>
        logWatchError("casino.keeper.websocket_closed", new Error("WebSocket connection closed"));
      rpcClient.socket.addEventListener("close", onClose);
      closeWebSocket = () => {
        rpcClient.socket.removeEventListener("close", onClose);
        rpcClient.close();
      };
      unwatchers.push(
        wsClient.watchContractEvent({
          poll: false,
          address: config.gameHub,
          abi: GAME_HUB_KEEPER_ABI,
          eventName: "BetRandomReady",
          onLogs: (logs) => {
            (logs as unknown as Parameters<typeof enqueueBetRandomReadyLog>[0][]).forEach(
              enqueueBetRandomReadyLog
            );
            void trackOperation(
              writeBetIndexLogs("BetRandomReady", logs as unknown as GameHubLog[])
            ).catch(() => undefined);
          },
          onError: (error) => logWatchError("casino.keeper.gamehub_watch_error", error)
        })
      );
      unwatchers.push(
        wsClient.watchContractEvent({
          poll: false,
          address: config.gameHub,
          abi: GAME_HUB_KEEPER_ABI,
          eventName: "BetPlaced",
          onLogs: (logs) => {
            for (const log of logs as unknown as GameHubLog[])
              if (log.args?.positionId != null)
                enqueue({
                  source: "gameHub",
                  betId: BigInt(log.args.positionId as bigint),
                  receivedAt: Date.now(),
                  blockNumber: log.blockNumber
                });
            void trackOperation(
              writeBetIndexLogs("BetPlaced", logs as unknown as GameHubLog[])
            ).catch(() => undefined);
          },
          onError: (error) =>
            logWatchError("casino.keeper.gamehub_index_watch_error", error, "BetPlaced")
        })
      );
      if (betIndexStore) {
        for (const eventName of ["BetFinalized", "BetRefunded", "BetVoided"] as const) {
          unwatchers.push(
            wsClient.watchContractEvent({
              poll: false,
              address: config.gameHub,
              abi: GAME_HUB_KEEPER_ABI,
              eventName,
              onLogs: (logs) =>
                void trackOperation(
                  writeBetIndexLogs(eventName, logs as unknown as GameHubLog[])
                ).catch(() => undefined),
              onError: (error) =>
                logWatchError("casino.keeper.gamehub_index_watch_error", error, eventName)
            })
          );
        }
      }
      for (const eventName of ["ResultReceived", "CallbackAttempt"] as const) {
        unwatchers.push(
          wsClient.watchContractEvent({
            poll: false,
            address: config.vrfHub,
            abi: VRF_HUB_KEEPER_ABI,
            eventName,
            onLogs: (logs) => {
              void trackOperation(
                (async () => {
                  for (const log of logs)
                    await enqueueVrfLog({
                      ...(log as unknown as Parameters<typeof enqueueVrfLog>[0]),
                      eventName
                    });
                  await drainQueue();
                })()
              ).catch((error) => {
                logger.error("casino.keeper.vrf_result_recovery_failed", {
                  error: describeError(error)
                });
                writeHealth(health.recordError(describeError(error), queue.size, "recovery"));
              });
            },
            onError: (error) => logWatchError("casino.keeper.vrfhub_watch_error", error, eventName)
          })
        );
      }
      logger.info("casino.keeper.websocket_watchers_registered", { watchers: unwatchers.length });
    } catch (error) {
      logWatchError("casino.keeper.websocket_connect_failed", error);
    }
  };

  const start = async () => {
    logger.info("casino.keeper.starting", {
      chainId: config.chainId,
      role: config.role,
      gameHub: config.gameHub,
      vrfHub: config.vrfHub,
      keeper: account.address,
      scanIndexEventsEnabled: config.scanIndexEventsEnabled,
      startBlock: lastScannedBlock.toString(),
      scanChunkBlocks: config.scanChunkBlocks.toString(),
      scanMaxChunksPerPass: config.scanMaxChunksPerPass,
      startupScanEnabled: config.startupScanEnabled,
      wsEnabled: Boolean(wsClient),
      vaultProviderLedgerPoolCount: config.vaultProviderLedgerPools.length,
      vaultProviderLedgerScanIntervalMs: config.vaultProviderLedgerScanIntervalMs,
      voidGasLimit: config.voidGasLimit.toString(),
      poolRegistry: config.poolRegistry
    });
    writeHealth(health.recordStarted(lastScannedBlock, queue.size));
    // A KEEPER_VOID_GAS_LIMIT outside the GameHub floor and Base's cap stops the keeper here. An
    // unreadable GameHub only defers the check to the first void candidate.
    try {
      await requireVoidParameters();
    } catch (error) {
      if (error instanceof VoidConfigurationError) throw error;
      logger.warn("casino.void.parameters_unavailable", { error: describeError(error) });
    }
    await initializeBetIndex();
    checkStartupRecovery();

    // Connecting cannot access the store or submit writes. Do not join a stalled
    // handshake on shutdown; the stopped check closes any socket that arrives later.
    void startWebSocketWatchers();

    timers.push(setInterval(() => void trackOperation(drainQueue()), 500));
    if (config.pollIntervalMs > 0) {
      timers.push(setInterval(() => void trackOperation(runScan()), config.pollIntervalMs));
    } else if (betIndexStore) {
      // Disabling RPC catch-up must not strand the next page of durable work.
      timers.push(
        setInterval(
          () =>
            void trackOperation(requeueIndexedBets()).catch((error) => {
              logger.error("casino.keeper.indexed_recovery_failed", {
                error: describeError(error)
              });
              writeHealth(health.recordError(describeError(error), queue.size, "recovery"));
            }),
          300_000
        )
      );
    }
    if (
      config.vaultProviderLedgerPools.length > 0 &&
      config.vaultProviderLedgerScanIntervalMs > 0
    ) {
      timers.push(
        setInterval(
          () => void trackOperation(runVaultProviderLedgerScan()),
          config.vaultProviderLedgerScanIntervalMs
        )
      );
    }
    timers.push(
      setInterval(() => {
        writeHealth(health.recordHeartbeat(queue.size, rpcUsage.snapshot()));
        void trackOperation(runLifecycleScan());
      }, 10_000)
    );
    if (recoveryOrigin != null)
      await health.recordError(
        "Casino lifecycle history is awaiting reconciliation",
        queue.size,
        "recovery"
      );
    void trackOperation(runLifecycleScan());
    if (config.startupScanEnabled) {
      void trackOperation(runScan());
      void trackOperation(runVaultProviderLedgerScan());
    } else {
      logger.info("casino.keeper.startup_scan_skipped", {
        scanIndexEventsEnabled: config.scanIndexEventsEnabled,
        wsEnabled: Boolean(wsClient)
      });
    }
    writeHealth(health.recordRunning(lastScannedBlock, queue.size));
  };

  const stop = async () => {
    stopped = true;
    timers.forEach(clearInterval);
    if (wsRetryTimer != null) clearTimeout(wsRetryTimer);
    stopWebSocketWatchers();
    // In-flight work can enqueue a final health write while it finishes, so join until empty.
    while (activeOperations.size > 0) await Promise.allSettled([...activeOperations]);
    await writeTail;
    await betIndexStore?.close?.();
    await health.recordStopped(queue.size);
    logger.info("casino.keeper.stopped");
  };

  return { start, stop, enqueue, queue, health };
}

async function writeBetIndexRange(
  store: BetIndexStore | undefined,
  publicClient: PublicClient,
  config: KeeperConfig,
  range: { fromBlock: bigint; toBlock: bigint },
  logsByEvent: ReadonlyMap<GameHubIndexEventName, GameHubLog[]>,
  logger: KeeperLogger
) {
  if (!store) return;
  try {
    for (const eventName of GAME_HUB_INDEX_EVENTS) {
      const logs = logsByEvent.get(eventName) ?? [];
      const stampedLogs = await attachBlockTimestamps(publicClient, logs);
      const events = stampedLogs
        .map((log) => toBetIndexEvent(config.chainId, config.gameHub, eventName, log))
        .filter((event): event is BetIndexEvent => Boolean(event));
      await store.writeGameHubEvents(await enrichFinalizedBetEvents(publicClient, events));
    }
    await store.setCursor({
      blockNumber: range.toBlock,
      chainId: config.chainId,
      cursorKey: config.gameHub,
      source: BET_INDEX_CURSOR_SOURCE
    });
  } catch (error) {
    logger.error("casino.keeper.bet_index_scan_failed", {
      fromBlock: range.fromBlock.toString(),
      error: describeError(error),
      toBlock: range.toBlock.toString()
    });
    throw error;
  }
}

async function writeVaultProviderLedgerRange(
  store: BetIndexStore,
  publicClient: PublicClient,
  config: KeeperConfig,
  range: { fromBlock: bigint; toBlock: bigint },
  logger: KeeperLogger
) {
  try {
    const rowsByPool = await fetchVaultProviderLedgerRows({
      chainId: config.chainId,
      pools: config.vaultProviderLedgerPools,
      publicClient,
      range
    });
    for (const { pool, rows } of rowsByPool) {
      await store.replaceVaultProviderLedgerRange({
        chainId: config.chainId,
        vault: pool.vault,
        ...range,
        rows
      });
    }
    await store.setCursor({
      blockNumber: range.toBlock,
      chainId: config.chainId,
      cursorKey: config.gameHub,
      source: VAULT_PROVIDER_LEDGER_CURSOR_SOURCE
    });
  } catch (error) {
    logger.error("casino.keeper.vault_provider_ledger_scan_failed", {
      fromBlock: range.fromBlock.toString(),
      error: describeError(error),
      toBlock: range.toBlock.toString()
    });
    throw error;
  }
}

function toBetIndexEvent(
  chainId: number,
  gameHub: Address,
  eventName: GameHubEventName,
  log: {
    args?: Record<string, unknown>;
    blockNumber?: bigint;
    blockTimestamp?: bigint | number;
    logIndex?: number;
    transactionHash?: Hex;
  }
): BetIndexEvent | null {
  if (log.blockNumber == null || log.transactionHash == null || log.logIndex == null) return null;
  return {
    args: log.args ?? {},
    blockNumber: log.blockNumber,
    blockTimestamp: normalizeBlockTimestamp(log.blockTimestamp),
    chainId,
    eventName,
    gameHub,
    logIndex: log.logIndex,
    txHash: log.transactionHash
  };
}

async function attachBlockTimestamps<
  T extends {
    blockNumber?: bigint;
    blockTimestamp?: bigint | number;
  }
>(
  publicClient: PublicClient,
  logs: readonly T[]
): Promise<Array<T & { blockTimestamp?: bigint | number }>> {
  const blockTimestampPromises = new Map<string, Promise<number | undefined>>();

  const getTimestamp = (blockNumber: bigint) => {
    const key = blockNumber.toString();
    let existing = blockTimestampPromises.get(key);
    if (!existing) {
      existing = publicClient
        .getBlock({ blockNumber })
        .then((block) => Number(block.timestamp) * 1000)
        .catch(() => undefined);
      blockTimestampPromises.set(key, existing);
    }
    return existing;
  };

  return Promise.all(
    logs.map(async (log) => {
      if (log.blockNumber == null) return log;
      if (normalizeBlockTimestamp(log.blockTimestamp) != null) return log;
      const blockTimestamp = await getTimestamp(log.blockNumber);
      return blockTimestamp == null ? log : { ...log, blockTimestamp };
    })
  );
}

function normalizeBlockTimestamp(value: bigint | number | undefined) {
  if (typeof value === "bigint") return Number(value) * 1000;
  return typeof value === "number" ? value : undefined;
}

type TerminalBetRead = {
  asset: Address;
  betId: bigint;
  gameId: Hex;
  placedAt: bigint | number;
  refundDeadline: bigint | number;
  player: Address;
  randomHash: Hex;
  requestId: bigint | number;
  stake: bigint | number;
};

async function buildTerminalBetRow({
  betId,
  chainId,
  gameHub,
  publicClient,
  txHash
}: {
  betId: bigint;
  chainId: number;
  gameHub: Address;
  publicClient: PublicClient;
  txHash: Hex;
}): Promise<{ row: BetRow; houseEdge: BetIndexEvent | null }> {
  const [bet, receipt, referralPayees] = await Promise.all([
    publicClient.readContract({
      address: gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "getBet",
      args: [betId]
    }) as Promise<TerminalBetRead>,
    publicClient.getTransactionReceipt({ hash: txHash }),
    publicClient.readContract({
      address: gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "getBetReferralPayees",
      args: [betId]
    }) as Promise<readonly [Address, Address]>
  ]);
  const terminal = decodeTerminalLog({
    betId,
    gameHub,
    logs: receipt.logs
  });
  if (!terminal) {
    throw new Error(`terminal receipt log not found for bet ${betId.toString()}`);
  }

  const block = receipt.blockNumber
    ? await publicClient.getBlock({ blockNumber: receipt.blockNumber })
    : null;
  const updatedAt = block?.timestamp == null ? Date.now() : Number(block.timestamp) * 1000;
  const normalizedBetId = betId.toString();
  const row: BetRow = {
    asset: getAddress(bet.asset) as Address,
    betId: normalizedBetId,
    chainId,
    gameHub,
    gameId: bet.gameId,
    id: `${chainId}:${gameHub.toLowerCase()}:${normalizedBetId}`,
    lastEventName: terminal.eventName,
    lastTxHash: txHash,
    placedAt: secondsToMs(bet.placedAt),
    refundDeadline: secondsToMs(bet.refundDeadline),
    player: getAddress(bet.player) as Address,
    referrerL1: getAddress(referralPayees[0]) as Address,
    referrerL2: getAddress(referralPayees[1]) as Address,
    randomHash: bet.randomHash,
    requestId: BigInt(bet.requestId).toString(),
    stake: BigInt(bet.stake).toString(),
    state:
      terminal.eventName === "BetRefunded"
        ? "refunded"
        : terminal.eventName === "BetVoided"
          ? "voided"
          : "finalized",
    terminalTxHash: txHash,
    updatedAt,
    updatedBlock: Number(receipt.blockNumber ?? 0n)
  };

  if (terminal.eventName === "BetFinalized") {
    row.finalizedTxHash = txHash;
    row.payoutGross = bigintString(terminal.args.payoutGross);
    row.payout = bigintString(terminal.args.payoutNet);
    row.refundAmount = (
      await readSettledBetRefund({
        client: publicClient,
        gameHub,
        betId,
        args: terminal.args
      })
    ).toString();
  } else if (terminal.eventName === "BetVoided") {
    // The stake became a player payable; nothing was paid out.
    row.voidedTxHash = txHash;
    row.refundAmount = bigintString(terminal.args.stake);
    row.payout = "0";
    row.payoutGross = "0";
    row.voidCaller = getAddress(String(terminal.args.caller)) as Address;
    row.voidSettlementErrorPrefix = terminal.args.settlementErrorPrefix as Hex;
  } else {
    row.refundedTxHash = txHash;
    row.refundAmount = bigintString(terminal.args.refundAmount);
    row.payout = row.refundAmount;
  }

  return {
    row,
    houseEdge: decodeHouseEdgeLog({ betId, blockTimestamp: updatedAt, chainId, gameHub, receipt })
  };
}

function decodeTerminalLog({
  betId,
  gameHub,
  logs
}: {
  betId: bigint;
  gameHub: Address;
  logs: Array<{ address?: Address; data: Hex; topics: readonly Hex[] }>;
}) {
  for (const log of logs) {
    if (log.address == null || getAddress(log.address) !== getAddress(gameHub)) continue;
    for (const eventName of ["BetFinalized", "BetRefunded", "BetVoided"] as const) {
      try {
        const decoded = decodeEventLog({
          abi: GAME_HUB_KEEPER_ABI,
          data: log.data,
          eventName,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]]
        });
        if (decoded.eventName !== eventName) continue;
        const args = decoded.args as unknown as Record<string, unknown>;
        if (BigInt(String(args.positionId ?? args.betId ?? 0)) !== betId) continue;
        return { args, eventName };
      } catch {
        // Try the next terminal event ABI.
      }
    }
  }
  return null;
}

function secondsToMs(value: bigint | number | undefined) {
  const numeric = Number(value ?? 0);
  return numeric > 0 ? numeric * 1000 : undefined;
}

function bigintString(value: unknown) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return BigInt(value).toString();
  }
  return "0";
}

export function resolveBetIndexResumeBlock(currentStartBlock: bigint, cursorBlock: bigint | null) {
  return cursorBlock != null && cursorBlock > currentStartBlock ? cursorBlock : currentStartBlock;
}
