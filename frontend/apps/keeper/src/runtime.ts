import {
  createPublicClient,
  createWalletClient,
  defineChain,
  decodeEventLog,
  getAddress,
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
  readSettledBetRefund,
  type BetIndexEvent,
  type BetRow,
  type BetIndexStore,
  type SportsHubEventName,
  type SportsTicketIndexEvent
} from "@ssot/bet-index";

import { GAME_HUB_KEEPER_ABI, SPORTS_HUB_KEEPER_ABI, VRF_HUB_KEEPER_ABI } from "./abi.js";
import { fetchBankProviderLedgerRows } from "./bank-provider-ledger.js";
import { describeError } from "./errors.js";
import { finalizeIfReady, retryDelayMs } from "./finalizer.js";
import { createFileHealthSink, KeeperHealthReporter } from "./health.js";
import { FinalizeQueue, type QueueItem } from "./queue.js";
import { isScanTruncated, splitBlockRange, type BlockRange } from "./scan.js";
import { mapBetState } from "./state.js";
import { mapSportsMarketState, mapSportsTicketState } from "./sports-terminalizer.js";
import type { BetRead, KeeperConfig, KeeperEvent, KeeperLogger } from "./types.js";
import { createSportsRecovery } from "./sports-recovery.js";

type GameHubEventName = BetIndexEvent["eventName"];
type SportsTerminalizerEventName =
  | "MarketVoided"
  | "ResultChallengeResolved"
  | "ResultFinalized"
  | "ResultProposed";
const SPORTS_TICKET_EVENTS: SportsHubEventName[] = [
  "TicketPlaced",
  "TicketSettled",
  "TicketRefunded",
  "TicketVoided"
];
const SPORTS_TERMINALIZER_EVENTS: SportsTerminalizerEventName[] = [
  "ResultProposed",
  "ResultFinalized",
  "MarketVoided",
  "ResultChallengeResolved"
];
const BET_INDEX_CURSOR_SOURCE = "gamehub-events";
const BANK_PROVIDER_LEDGER_CURSOR_SOURCE = "bank-provider-ledger";
const CASINO_RECOVERY_PAGE_SIZE = 50;
const RPC_USAGE_WINDOW_MS = 60_000;
const TRACKED_RPC_METHODS = new Set([
  "getBlock",
  "getBlockNumber",
  "getContractEvents",
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
  if (
    (config.sportsTerminalizerEnabled || config.sportsTicketIndexEnabled) &&
    (!config.betIndexWriteEnabled ||
      !config.betIndexDatabaseUrl ||
      !config.sportsHub ||
      config.sportsHub.toLowerCase() === "0x0000000000000000000000000000000000000000")
  ) {
    throw new Error(
      "Sports recovery requires BET_INDEX_WRITE_ENABLED=true, BET_INDEX_DATABASE_URL and a sportsHub release address; no transactions were started"
    );
  }
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
          transport: webSocket(config.wsRpcUrl)
        });

  const queue = new FinalizeQueue();
  const health = new KeeperHealthReporter({
    config,
    keeper: account.address,
    sink: config.healthPath ? createFileHealthSink(config.healthPath) : undefined
  });
  const timers: Array<ReturnType<typeof setInterval>> = [];
  const unwatchers: Array<() => void> = [];
  let stopped = false;
  let scanning = false;
  let bankProviderLedgerScanning = false;
  let lastScannedBlock = config.startBlock ?? 0n;
  let bankProviderLedgerLastScannedBlock = config.startBlock ?? 0n;
  let recoveryAfterBetId = 0n;
  let recoveringIndexedBets = false;
  const betIndexStore =
    config.betIndexWriteEnabled && config.betIndexDatabaseUrl
      ? createPostgresBetIndexStore({
          connectionString: config.betIndexDatabaseUrl,
          ssl: config.betIndexSsl
        })
      : undefined;

  const writeHealth = (op: Promise<void>) => {
    void op.catch((error) => {
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
      const ids = await betIndexStore.getRandomReadyBetIds({
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
    })) as unknown as { betId: bigint; requestId: bigint; state: number };
    return {
      betId: BigInt(bet.betId),
      requestId: BigInt(bet.requestId),
      state: mapBetState(Number(bet.state))
    };
  };

  const simulateFinalize = async (betId: bigint) => {
    await publicClient.simulateContract({
      account: account.address,
      address: config.gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "finalize",
      args: [betId]
    });
  };

  const writeFinalize = async (betId: bigint) =>
    walletClient.writeContract({
      account,
      address: config.gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "finalize",
      args: [betId],
      chain
    });

  const waitFinalizeReceipt = async (txHash: Hex) => {
    const receipt = await publicClient.waitForTransactionReceipt({
      checkReplacement: false,
      hash: txHash,
      pollingInterval: 1_000
    });
    return { status: receipt.status };
  };

  const materializeCasinoReceipt = async (event: KeeperEvent, txHash: Hex) => {
    if (!betIndexStore) return;
    const row = await buildTerminalBetRow({
      betId: event.betId,
      chainId: config.chainId,
      gameHub: config.gameHub,
      publicClient,
      txHash
    });
    await betIndexStore.writeBetRows([row]);
    logger.info("casino.keeper.receipt_materialized", {
      betId: event.betId.toString(),
      eventName: row.lastEventName,
      txHash
    });
  };

  const waitSportsReceipt = async (txHash: Hex) => {
    const receipt = await publicClient.waitForTransactionReceipt({
      checkReplacement: false,
      hash: txHash,
      pollingInterval: 1_000
    });
    return { status: receipt.status };
  };

  const readSportsMarket = async (marketId: bigint) => {
    if (!config.sportsHub) throw new Error("sportsHub is not configured");
    const market = (await publicClient.readContract({
      address: config.sportsHub,
      abi: SPORTS_HUB_KEEPER_ABI,
      functionName: "getMarket",
      args: [marketId]
    })) as unknown as { marketId: bigint; state: number };
    return {
      marketId: BigInt(market.marketId),
      state: mapSportsMarketState(Number(market.state))
    };
  };

  const readSportsResult = async (marketId: bigint) => {
    if (!config.sportsHub) throw new Error("sportsHub is not configured");
    const result = (await publicClient.readContract({
      address: config.sportsHub,
      abi: SPORTS_HUB_KEEPER_ABI,
      functionName: "getResult",
      args: [marketId]
    })) as unknown as { challenged: boolean; finalizesAt: number | bigint; marketId: bigint };
    return {
      challenged: Boolean(result.challenged),
      finalizesAt: Number(result.finalizesAt),
      marketId: BigInt(result.marketId)
    };
  };

  const readSportsTicket = async (ticketId: bigint) => {
    if (!config.sportsHub) throw new Error("sportsHub is not configured");
    const ticket = (await publicClient.readContract({
      address: config.sportsHub,
      abi: SPORTS_HUB_KEEPER_ABI,
      functionName: "getTicket",
      args: [ticketId]
    })) as unknown as { marketId: bigint | number; state: number; ticketId: bigint };
    return {
      marketId: BigInt(ticket.marketId),
      state: mapSportsTicketState(Number(ticket.state)),
      ticketId: BigInt(ticket.ticketId)
    };
  };

  const simulateSportsWrite = async (
    functionName: "finalizeResult" | "refundTicket" | "settleTicket",
    id: bigint
  ) => {
    if (!config.sportsHub) throw new Error("sportsHub is not configured");
    await publicClient.simulateContract({
      account: account.address,
      address: config.sportsHub,
      abi: SPORTS_HUB_KEEPER_ABI,
      functionName,
      args: [id]
    });
  };

  const writeSportsContract = async (
    functionName: "finalizeResult" | "refundTicket" | "settleTicket",
    id: bigint
  ) => {
    if (!config.sportsHub) throw new Error("sportsHub is not configured");
    return walletClient.writeContract({
      account,
      address: config.sportsHub,
      abi: SPORTS_HUB_KEEPER_ABI,
      functionName,
      args: [id],
      chain
    });
  };

  const sportsRecovery =
    betIndexStore && (config.sportsTerminalizerEnabled || config.sportsTicketIndexEnabled)
      ? createSportsRecovery({
          config,
          store: betIndexStore,
          publicClient,
          logger,
          deps: {
            logger,
            readMarket: readSportsMarket,
            readResult: readSportsResult,
            readTicket: readSportsTicket,
            simulateFinalizeResult: (id) => simulateSportsWrite("finalizeResult", id),
            simulateRefundTicket: (id) => simulateSportsWrite("refundTicket", id),
            simulateSettleTicket: (id) => simulateSportsWrite("settleTicket", id),
            waitReceipt: waitSportsReceipt,
            writeFinalizeResult: (id) => writeSportsContract("finalizeResult", id),
            writeRefundTicket: (id) => writeSportsContract("refundTicket", id),
            writeSettleTicket: (id) => writeSportsContract("settleTicket", id)
          }
        })
      : undefined;

  const processItem = async (item: QueueItem) => {
    try {
      const outcome = await finalizeIfReady(item, {
        readBet,
        simulateFinalize,
        writeFinalize,
        waitFinalizeReceipt,
        materializeReceipt: materializeCasinoReceipt,
        logger
      });

      if (outcome.kind === "failed" && outcome.retryable && item.attempts < 8) {
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
      if (item.attempts < 8) {
        queue.retry(item, retryDelayMs(item.attempts));
      } else {
        queue.complete(item.betId);
      }
      const description = describeError(error);
      logger.error("casino.keeper.process_failed", {
        betId: item.betId.toString(),
        error: description
      });
      writeHealth(health.recordError(description, queue.size, "finalize"));
    }
  };

  const drainQueue = async () => {
    if (stopped) return;
    for (;;) {
      const item = queue.nextReady();
      if (!item) return;
      void processItem(item);
    }
  };

  const enqueueBetRandomReadyLog = (log: {
    args?: { betId?: bigint; requestId?: bigint; randomHash?: Hex };
    blockNumber?: bigint;
    transactionHash?: Hex;
  }) => {
    const betId = log.args?.betId;
    if (betId == null) return;
    enqueue({
      source: "gameHub",
      betId,
      requestId: log.args?.requestId,
      randomHash: log.args?.randomHash,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      receivedAt: Date.now()
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

  const writeSportsTicketIndexLogs = async (
    eventName: SportsHubEventName,
    logs: Array<{
      args?: Record<string, unknown>;
      blockNumber?: bigint;
      logIndex?: number;
      transactionHash?: Hex;
    }>
  ) => {
    if (!betIndexStore || !config.sportsHub || logs.length === 0) return;
    const events = logs
      .map((log) => toSportsTicketIndexEvent(config.chainId, config.sportsHub!, eventName, log))
      .filter((event): event is SportsTicketIndexEvent => Boolean(event));
    if (events.length === 0) return;
    try {
      await betIndexStore.writeSportsHubEvents(events);
    } catch (error) {
      logger.error("casino.keeper.sports_ticket_index_write_failed", {
        eventName,
        error: describeError(error)
      });
    }
  };

  const scheduleSportsTerminalizerLogs = (
    _eventName: SportsTerminalizerEventName,
    logs: Array<{
      args?: { finalizesAt?: bigint | number; marketId?: bigint | number };
      blockNumber?: bigint | null;
    }>
  ) => {
    if (!sportsRecovery || !config.sportsTerminalizerEnabled) return;
    void (async () => {
      for (const log of logs) {
        if (log.args?.marketId == null || log.blockNumber == null) continue;
        await sportsRecovery.enqueue(
          BigInt(log.args.marketId),
          log.blockNumber,
          log.args.finalizesAt == null ? undefined : Number(log.args.finalizesAt)
        );
      }
      await sportsRecovery.scan();
      await sportsRecovery.runDue();
    })().catch((error) => {
      logger.error("sports.terminalizer.enqueue_failed", { error: describeError(error) });
    });
  };

  const initializeBetIndex = async () => {
    if (!betIndexStore) return;
    try {
      await betIndexStore.migrate();
      logger.info("casino.keeper.bet_index_ready");
      const cursor = await betIndexStore.getCursor(
        config.chainId,
        BET_INDEX_CURSOR_SOURCE,
        config.gameHub
      );
      const resumeBlock = resolveBetIndexResumeBlock(lastScannedBlock, cursor);
      const bankProviderCursor =
        (await betIndexStore.getCursor(
          config.chainId,
          BANK_PROVIDER_LEDGER_CURSOR_SOURCE,
          config.gameHub
        )) ?? cursor;
      const bankProviderResumeBlock = resolveBetIndexResumeBlock(
        bankProviderLedgerLastScannedBlock,
        bankProviderCursor
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
      if (bankProviderResumeBlock > bankProviderLedgerLastScannedBlock) {
        const configuredStartBlock = bankProviderLedgerLastScannedBlock;
        bankProviderLedgerLastScannedBlock = bankProviderResumeBlock;
        logger.info("casino.keeper.bank_provider_ledger_cursor_resumed", {
          configuredStartBlock: configuredStartBlock.toString(),
          cursorBlock: bankProviderResumeBlock.toString()
        });
      }
      await requeueIndexedBets();
    } catch (error) {
      logger.error("casino.keeper.bet_index_migrate_failed", { error: describeError(error) });
      if (sportsRecovery) throw error;
    }
  };

  const enqueueFulfilledLog = (log: {
    args?: { hub?: Address; betId?: bigint; requestId?: bigint; randomHash?: Hex };
    blockNumber?: bigint;
    transactionHash?: Hex;
  }) => {
    const betId = log.args?.betId;
    if (betId == null) return;
    if (log.args?.hub && getAddress(log.args.hub) !== getAddress(config.gameHub)) return;
    enqueue({
      source: "vrfHub",
      betId,
      requestId: log.args?.requestId,
      randomHash: log.args?.randomHash,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      receivedAt: Date.now()
    });
  };

  /**
   * A capped pass leaves the cursor short of the head and resumes next tick.
   * Without this line an operator watching a quiet log has no way to tell a
   * caught-up keeper from one still grinding through a months-old backlog.
   */
  const reportScanCap = (scanner: string, ranges: BlockRange[], latest: bigint) => {
    if (!isScanTruncated(ranges, latest)) return;
    const last = ranges[ranges.length - 1]!;
    logger.info("casino.keeper.scan_capped", {
      scanner,
      chunks: ranges.length,
      scannedThrough: last.toBlock.toString(),
      headBlock: latest.toString(),
      remainingBlocks: (latest - last.toBlock).toString()
    });
  };

  const scanMissedEvents = async () => {
    const latest = await publicClient.getBlockNumber();
    if (latest <= lastScannedBlock) return;

    const fromBlock = lastScannedBlock === 0n ? latest : lastScannedBlock + 1n;
    const ranges = splitBlockRange({
      fromBlock,
      toBlock: latest,
      chunkSize: config.scanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass
    });
    reportScanCap("gamehub-events", ranges, latest);
    for (const range of ranges) {
      const logs = await publicClient.getContractEvents({
        address: config.gameHub,
        abi: GAME_HUB_KEEPER_ABI,
        eventName: "BetRandomReady",
        fromBlock: range.fromBlock,
        toBlock: range.toBlock
      });
      for (const log of logs) {
        if (log.args.betId == null) continue;
        enqueue({
          source: "scan",
          betId: BigInt(log.args.betId),
          requestId: log.args.requestId == null ? undefined : BigInt(log.args.requestId),
          randomHash: log.args.randomHash,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          receivedAt: Date.now()
        });
      }
      if (config.scanIndexEventsEnabled) {
        await writeBetIndexRange(betIndexStore, publicClient, config, range, logger);
      } else {
        await writeBetIndexLogs("BetRandomReady", logs);
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
      writeHealth(health.recordScan(lastScannedBlock, queue.size));
    }
  };

  const scanBankProviderLedgerEvents = async () => {
    if (
      !betIndexStore ||
      config.bankProviderLedgerPools.length === 0 ||
      config.bankProviderLedgerScanIntervalMs <= 0
    ) {
      return;
    }
    const latest = await publicClient.getBlockNumber();
    if (latest <= bankProviderLedgerLastScannedBlock) return;

    const fromBlock =
      bankProviderLedgerLastScannedBlock === 0n ? latest : bankProviderLedgerLastScannedBlock + 1n;
    const ranges = splitBlockRange({
      fromBlock,
      toBlock: latest,
      chunkSize: config.scanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass
    });
    reportScanCap("bank-provider-ledger", ranges, latest);
    for (const range of ranges) {
      await writeBankProviderLedgerRange(betIndexStore, publicClient, config, range, logger);
      bankProviderLedgerLastScannedBlock = range.toBlock;
    }
  };

  const runScan = async () => {
    if (stopped || scanning) return;
    scanning = true;
    try {
      try {
        await scanMissedEvents();
      } finally {
        await requeueIndexedBets();
      }
    } catch (error) {
      const description = describeError(error);
      logger.error("casino.keeper.scan_failed", { error: description });
      writeHealth(health.recordError(description, queue.size, "scan"));
    } finally {
      scanning = false;
    }
  };

  const runBankProviderLedgerScan = async () => {
    if (stopped || bankProviderLedgerScanning) return;
    bankProviderLedgerScanning = true;
    try {
      await scanBankProviderLedgerEvents();
      writeHealth(health.recordLedgerScan(queue.size));
    } catch (error) {
      const description = describeError(error);
      logger.error("casino.keeper.bank_provider_ledger_scan_failed", { error: description });
      writeHealth(health.recordError(description, queue.size, "ledger"));
    } finally {
      bankProviderLedgerScanning = false;
    }
  };

  /**
   * viem hands a watcher the raw socket error. Node's WebSocket reports a refused, rejected
   * (HTTP 401/429) or dropped connection as an ErrorEvent whose message is empty, and viem's
   * own socket errors put the RPC URL in theirs, so neither is logged as-is.
   */
  const logWatchError = (event: string, error: unknown, eventName?: string) =>
    logger.error(event, { eventName, transport: "websocket", error: describeError(error) });

  const start = async () => {
    logger.info("casino.keeper.starting", {
      chainId: config.chainId,
      role: config.role,
      gameHub: config.gameHub,
      sportsHub: config.sportsHub,
      vrfHub: config.vrfHub,
      keeper: account.address,
      scanIndexEventsEnabled: config.scanIndexEventsEnabled,
      startBlock: lastScannedBlock.toString(),
      scanChunkBlocks: config.scanChunkBlocks.toString(),
      scanMaxChunksPerPass: config.scanMaxChunksPerPass,
      startupScanEnabled: config.startupScanEnabled,
      wsEnabled: Boolean(wsClient),
      bankProviderLedgerPoolCount: config.bankProviderLedgerPools.length,
      bankProviderLedgerScanIntervalMs: config.bankProviderLedgerScanIntervalMs,
      sportsTicketIndexEnabled: config.sportsTicketIndexEnabled,
      sportsTerminalizerScanChunkBlocks: config.sportsTerminalizerScanChunkBlocks.toString(),
      sportsTerminalizerMarketIds: config.sportsTerminalizerMarketIds.map((id) => id.toString()),
      sportsTicketScanChunkBlocks: config.sportsTicketScanChunkBlocks.toString(),
      sportsTicketEnumerationMax: config.sportsTicketEnumerationMax,
      sportsTicketScanStartBlock: config.sportsTicketScanStartBlock.toString(),
      sportsTicketScanMaxBlocks: config.sportsTicketScanMaxBlocks.toString()
    });
    if (config.sportsTerminalizerEnabled && !config.sportsHub) {
      logger.warn("sports.terminalizer.disabled_missing_sports_hub");
    }
    writeHealth(health.recordStarted(lastScannedBlock, queue.size));
    await initializeBetIndex();
    await sportsRecovery?.prepare();

    if (wsClient) {
      unwatchers.push(
        wsClient.watchContractEvent({
          address: config.gameHub,
          abi: GAME_HUB_KEEPER_ABI,
          eventName: "BetRandomReady",
          onLogs: (logs) => {
            logs.forEach(enqueueBetRandomReadyLog);
            void writeBetIndexLogs("BetRandomReady", logs).catch(() => undefined);
          },
          onError: (error) => logWatchError("casino.keeper.gamehub_watch_error", error)
        })
      );
      if (betIndexStore) {
        for (const eventName of ["BetPlaced", "BetFinalized", "BetRefunded"] as const) {
          unwatchers.push(
            wsClient.watchContractEvent({
              address: config.gameHub,
              abi: GAME_HUB_KEEPER_ABI,
              eventName,
              onLogs: (logs) => void writeBetIndexLogs(eventName, logs).catch(() => undefined),
              onError: (error) =>
                logWatchError("casino.keeper.gamehub_index_watch_error", error, eventName)
            })
          );
        }
        if (config.sportsTicketIndexEnabled && config.sportsHub) {
          for (const eventName of SPORTS_TICKET_EVENTS) {
            unwatchers.push(
              wsClient.watchContractEvent({
                address: config.sportsHub,
                abi: SPORTS_HUB_KEEPER_ABI,
                eventName,
                onLogs: (logs) => void writeSportsTicketIndexLogs(eventName, logs),
                onError: (error) =>
                  logWatchError("casino.keeper.sports_ticket_index_watch_error", error, eventName)
              })
            );
          }
        }
      }
      if (config.sportsTerminalizerEnabled && config.sportsHub) {
        for (const eventName of SPORTS_TERMINALIZER_EVENTS) {
          unwatchers.push(
            wsClient.watchContractEvent({
              address: config.sportsHub,
              abi: SPORTS_HUB_KEEPER_ABI,
              eventName,
              onLogs: (logs) => scheduleSportsTerminalizerLogs(eventName, logs),
              onError: (error) => logWatchError("sports.terminalizer.watch_error", error, eventName)
            })
          );
        }
      }
      unwatchers.push(
        wsClient.watchContractEvent({
          address: config.vrfHub,
          abi: VRF_HUB_KEEPER_ABI,
          eventName: "Fulfilled",
          onLogs: (logs) => logs.forEach(enqueueFulfilledLog),
          onError: (error) => logWatchError("casino.keeper.vrfhub_watch_error", error)
        })
      );
    }

    timers.push(setInterval(() => void drainQueue(), 500));
    if (config.pollIntervalMs > 0) {
      timers.push(setInterval(() => void runScan(), config.pollIntervalMs));
    } else if (betIndexStore) {
      // Disabling RPC catch-up must not strand the next page of durable work.
      timers.push(
        setInterval(
          () =>
            void requeueIndexedBets().catch((error) => {
              logger.error("casino.keeper.indexed_recovery_failed", {
                error: describeError(error)
              });
            }),
          300_000
        )
      );
    }
    if (config.bankProviderLedgerPools.length > 0 && config.bankProviderLedgerScanIntervalMs > 0) {
      timers.push(
        setInterval(() => void runBankProviderLedgerScan(), config.bankProviderLedgerScanIntervalMs)
      );
    }
    timers.push(
      setInterval(
        () => writeHealth(health.recordHeartbeat(queue.size, rpcUsage.snapshot())),
        10_000
      )
    );
    if (config.startupScanEnabled) {
      void runScan();
      void runBankProviderLedgerScan();
    } else {
      logger.info("casino.keeper.startup_scan_skipped", {
        scanIndexEventsEnabled: config.scanIndexEventsEnabled,
        wsEnabled: Boolean(wsClient)
      });
    }
    await sportsRecovery?.start();
    writeHealth(health.recordRunning(lastScannedBlock, queue.size));
  };

  const stop = async () => {
    stopped = true;
    timers.forEach(clearInterval);
    unwatchers.forEach((unwatch) => unwatch());
    await sportsRecovery?.stop();
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
  logger: KeeperLogger
) {
  if (!store) return;
  try {
    for (const eventName of [
      "BetPlaced",
      "BetRandomReady",
      "BetFinalized",
      "BetRefunded"
    ] as const) {
      const logs = await publicClient.getContractEvents({
        address: config.gameHub,
        abi: GAME_HUB_KEEPER_ABI,
        eventName,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock
      });
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

async function writeBankProviderLedgerRange(
  store: BetIndexStore,
  publicClient: PublicClient,
  config: KeeperConfig,
  range: { fromBlock: bigint; toBlock: bigint },
  logger: KeeperLogger
) {
  try {
    for (const pool of config.bankProviderLedgerPools) {
      const rows = await fetchBankProviderLedgerRows({
        chainId: config.chainId,
        pool,
        publicClient,
        range
      });
      await store.writeBankProviderLedgerRows(rows);
    }
    await store.setCursor({
      blockNumber: range.toBlock,
      chainId: config.chainId,
      cursorKey: config.gameHub,
      source: BANK_PROVIDER_LEDGER_CURSOR_SOURCE
    });
  } catch (error) {
    logger.error("casino.keeper.bank_provider_ledger_scan_failed", {
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

function toSportsTicketIndexEvent(
  chainId: number,
  sportsHub: Address,
  eventName: SportsHubEventName,
  log: {
    args?: Record<string, unknown>;
    blockNumber?: bigint;
    logIndex?: number;
    transactionHash?: Hex;
  }
): SportsTicketIndexEvent | null {
  if (log.blockNumber == null || log.transactionHash == null || log.logIndex == null) return null;
  return {
    args: log.args ?? {},
    blockNumber: log.blockNumber,
    chainId,
    eventName,
    logIndex: log.logIndex,
    sportsHub,
    txHash: log.transactionHash
  };
}

type TerminalBetRead = {
  asset: Address;
  betId: bigint;
  gameId: Hex;
  placedAt: bigint | number;
  player: Address;
  pricingAffiliate: Address;
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
}): Promise<BetRow> {
  const [bet, receipt] = await Promise.all([
    publicClient.readContract({
      address: gameHub,
      abi: GAME_HUB_KEEPER_ABI,
      functionName: "getBet",
      args: [betId]
    }) as Promise<TerminalBetRead>,
    publicClient.getTransactionReceipt({ hash: txHash })
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
    gameId: bet.gameId,
    id: `${chainId}:${normalizedBetId}`,
    lastEventName: terminal.eventName,
    lastTxHash: txHash,
    placedAt: secondsToMs(bet.placedAt),
    player: getAddress(bet.player) as Address,
    pricingAffiliate: getAddress(bet.pricingAffiliate) as Address,
    randomHash: bet.randomHash,
    requestId: BigInt(bet.requestId).toString(),
    stake: BigInt(bet.stake).toString(),
    state: terminal.eventName === "BetRefunded" ? "refunded" : "finalized",
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
  } else {
    row.refundedTxHash = txHash;
    row.refundAmount = bigintString(terminal.args.refundAmount);
    row.payout = row.refundAmount;
  }

  return row;
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
    for (const eventName of ["BetFinalized", "BetRefunded"] as const) {
      try {
        const decoded = decodeEventLog({
          abi: GAME_HUB_KEEPER_ABI,
          data: log.data,
          eventName,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]]
        });
        const args = decoded.args as Record<string, unknown>;
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
