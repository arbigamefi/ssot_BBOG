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
  type BetIndexEvent,
  type BetRow,
  type BetIndexStore,
  type SportsHubEventName,
  type SportsTicketIndexEvent
} from "@ssot/bet-index";

import { GAME_HUB_KEEPER_ABI, SPORTS_HUB_KEEPER_ABI, VRF_HUB_KEEPER_ABI } from "./abi.js";
import { fetchBankProviderLedgerRows } from "./bank-provider-ledger.js";
import { finalizeIfReady, retryDelayMs } from "./finalizer.js";
import { createFileHealthSink, KeeperHealthReporter } from "./health.js";
import { FinalizeQueue, type QueueItem } from "./queue.js";
import { splitBlockRange } from "./scan.js";
import { mapBetState } from "./state.js";
import {
  mapSportsMarketState,
  mapSportsTicketState,
  terminalizeSportsMarket
} from "./sports-terminalizer.js";
import type { BetRead, KeeperConfig, KeeperEvent, KeeperLogger } from "./types.js";

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
  const sportsMarketTimers = new Map<
    string,
    { dueAt: number; timer: ReturnType<typeof setTimeout> }
  >();
  const unwatchers: Array<() => void> = [];
  let stopped = false;
  let scanning = false;
  let bankProviderLedgerScanning = false;
  let lastScannedBlock = config.startBlock ?? 0n;
  let bankProviderLedgerLastScannedBlock = config.startBlock ?? 0n;
  let sportsTerminalizerLastScannedBlock = config.startBlock ?? 0n;
  const betIndexStore =
    config.betIndexWriteEnabled && config.betIndexDatabaseUrl
      ? createPostgresBetIndexStore({
          connectionString: config.betIndexDatabaseUrl,
          ssl: config.betIndexSsl
        })
      : undefined;

  const writeHealth = (op: Promise<void>) => {
    void op.catch((error) => {
      logger.error("casino.keeper.health_write_failed", {
        message: (error as Error)?.message ?? "unknown error"
      });
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
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
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
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
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

  const findSportsTicketIds = async (marketId: bigint) => {
    if (!config.sportsHub) return [];
    if (betIndexStore) {
      try {
        const ticketIds = await betIndexStore.getHeldSportsTicketIdsByMarket({
          chainId: config.chainId,
          limit: config.sportsTerminalizerMaxTicketsPerMarket,
          marketId: marketId.toString()
        });
        if (ticketIds.length > 0) {
          logger.info("sports.terminalizer.ticket_discovery", {
            marketId: marketId.toString(),
            source: "bet-index",
            ticketCount: ticketIds.length
          });
          return ticketIds;
        }
      } catch (error) {
        logger.warn("sports.terminalizer.ticket_index_lookup_failed", {
          marketId: marketId.toString(),
          message: (error as Error)?.message ?? "ticket index lookup failed"
        });
      }
    }

    const enumeratedTicketIds = await findSportsTicketIdsByEnumeration(marketId);
    if (enumeratedTicketIds.length > 0) return enumeratedTicketIds;

    const latest = await publicClient.getBlockNumber();
    if (latest < config.sportsTicketScanStartBlock) return [];
    const ticketIds = new Set<bigint>();
    try {
      for (const range of splitBlockRange({
        fromBlock: config.sportsTicketScanStartBlock,
        toBlock: latest,
        chunkSize: config.sportsTicketScanChunkBlocks
      })) {
        const logs = await publicClient.getContractEvents({
          address: config.sportsHub,
          abi: SPORTS_HUB_KEEPER_ABI,
          eventName: "TicketPlaced",
          args: { marketId },
          fromBlock: range.fromBlock,
          toBlock: range.toBlock
        });
        for (const log of logs) {
          if (log.args.ticketId != null) ticketIds.add(BigInt(log.args.ticketId));
          if (ticketIds.size >= config.sportsTerminalizerMaxTicketsPerMarket) {
            return [...ticketIds];
          }
        }
      }
    } catch (error) {
      logger.warn("sports.terminalizer.ticket_log_lookup_failed", {
        fromBlock: config.sportsTicketScanStartBlock.toString(),
        marketId: marketId.toString(),
        message: (error as Error)?.message ?? "ticket log lookup failed",
        toBlock: latest.toString()
      });
    }
    logger.info("sports.terminalizer.ticket_discovery", {
      fromBlock: config.sportsTicketScanStartBlock.toString(),
      marketId: marketId.toString(),
      source: "logs",
      ticketCount: ticketIds.size,
      toBlock: latest.toString()
    });
    return [...ticketIds];
  };

  async function findSportsTicketIdsByEnumeration(marketId: bigint) {
    if (!config.sportsHub || config.sportsTicketEnumerationMax <= 0) return [];
    try {
      const nextTicketId = (await publicClient.readContract({
        address: config.sportsHub,
        abi: SPORTS_HUB_KEEPER_ABI,
        functionName: "nextTicketId"
      })) as bigint;
      const ticketIds: bigint[] = [];
      let checked = 0;
      for (
        let ticketId = nextTicketId > 0n ? nextTicketId - 1n : 0n;
        ticketId > 0n && checked < config.sportsTicketEnumerationMax;
        ticketId -= 1n
      ) {
        checked += 1;
        const ticket = await readSportsTicket(ticketId);
        if (ticket.marketId !== marketId || ticket.state !== "held") continue;
        ticketIds.push(ticketId);
        if (ticketIds.length >= config.sportsTerminalizerMaxTicketsPerMarket) break;
      }
      logger.info("sports.terminalizer.ticket_discovery", {
        checked,
        marketId: marketId.toString(),
        nextTicketId: nextTicketId.toString(),
        source: "contract-enumeration",
        ticketCount: ticketIds.length
      });
      return ticketIds;
    } catch (error) {
      logger.warn("sports.terminalizer.ticket_enumeration_failed", {
        marketId: marketId.toString(),
        message: (error as Error)?.message ?? "ticket enumeration failed"
      });
      return [];
    }
  }

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
      logger.error("casino.keeper.process_failed", {
        betId: item.betId.toString(),
        message: (error as Error)?.message ?? "unknown error"
      });
      writeHealth(
        health.recordError((error as Error)?.message ?? "unknown process failure", queue.size)
      );
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

  const processSportsMarket = async (
    marketId: bigint,
    source: SportsTerminalizerEventName,
    attempts = 0
  ) => {
    if (!config.sportsTerminalizerEnabled || !config.sportsHub || stopped) return;
    const outcome = await terminalizeSportsMarket(marketId, {
      findTicketIds: findSportsTicketIds,
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
    });

    if (
      outcome.kind === "skipped" &&
      outcome.reason === "finality-pending" &&
      outcome.finalizesAt
    ) {
      scheduleSportsMarket(marketId, source, outcome.finalizesAt, attempts);
      return;
    }

    if (outcome.kind === "failed" && outcome.retryable && attempts < 8) {
      logger.warn("sports.terminalizer.retry_scheduled", {
        attempts: attempts + 1,
        marketId: marketId.toString(),
        reason: outcome.reason
      });
      scheduleSportsMarket(marketId, source, undefined, attempts + 1);
      return;
    }

    logger.info("sports.terminalizer.outcome", {
      marketId: marketId.toString(),
      outcome,
      source
    });
  };

  function scheduleSportsMarket(
    marketId: bigint,
    source: SportsTerminalizerEventName,
    finalizesAt?: number,
    attempts = 0
  ) {
    if (!config.sportsTerminalizerEnabled || !config.sportsHub || stopped) return;
    const key = marketId.toString();
    if (sportsMarketTimers.has(key)) return;
    const nowMs = Date.now();
    const finalityDelayMs = finalizesAt == null ? 0 : Math.max(0, finalizesAt * 1000 - nowMs);
    const roleDelayMs = config.role === "backup" ? config.backupDelayMs : 0;
    const retryDelay = attempts > 0 ? retryDelayMs(attempts - 1) : 0;
    const delayMs = Math.max(finalityDelayMs, retryDelay) + roleDelayMs;
    const dueAt = nowMs + delayMs;
    const existing = sportsMarketTimers.get(key);
    if (existing && existing.dueAt <= dueAt) return;
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      sportsMarketTimers.delete(key);
      void processSportsMarket(marketId, source, attempts);
    }, delayMs);
    sportsMarketTimers.set(key, { dueAt, timer });
    logger.info("sports.terminalizer.scheduled", {
      attempts,
      delayMs,
      marketId: key,
      source
    });
  }

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
      await betIndexStore.writeGameHubEvents(events);
    } catch (error) {
      logger.error("casino.keeper.bet_index_write_failed", {
        eventName,
        message: (error as Error)?.message ?? "index write failed"
      });
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
        message: (error as Error)?.message ?? "sports ticket index write failed"
      });
    }
  };

  const scheduleSportsTerminalizerLogs = (
    eventName: SportsTerminalizerEventName,
    logs: Array<{
      args?: { finalizesAt?: bigint | number; marketId?: bigint | number };
    }>
  ) => {
    if (!config.sportsTerminalizerEnabled || !config.sportsHub || logs.length === 0) return;
    for (const log of logs) {
      if (log.args?.marketId == null) continue;
      scheduleSportsMarket(
        BigInt(log.args.marketId),
        eventName,
        log.args.finalizesAt == null ? undefined : Number(log.args.finalizesAt)
      );
    }
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
    } catch (error) {
      logger.error("casino.keeper.bet_index_migrate_failed", {
        message: (error as Error)?.message ?? "migration failed"
      });
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

  const scanMissedEvents = async () => {
    const latest = await publicClient.getBlockNumber();
    if (latest <= lastScannedBlock) return;

    const fromBlock = lastScannedBlock === 0n ? latest : lastScannedBlock + 1n;
    for (const range of splitBlockRange({
      fromBlock,
      toBlock: latest,
      chunkSize: config.scanChunkBlocks
    })) {
      const logs = await publicClient.getContractEvents({
        address: config.gameHub,
        abi: GAME_HUB_KEEPER_ABI,
        eventName: "BetRandomReady",
        fromBlock: range.fromBlock,
        toBlock: range.toBlock
      });
      await writeBetIndexRange(betIndexStore, publicClient, config, range, logger);
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
    for (const range of splitBlockRange({
      fromBlock,
      toBlock: latest,
      chunkSize: config.scanChunkBlocks
    })) {
      await writeBankProviderLedgerRange(betIndexStore, publicClient, config, range, logger);
      bankProviderLedgerLastScannedBlock = range.toBlock;
    }
  };

  const scanMissedSportsTerminalizerEvents = async () => {
    if (!config.sportsTerminalizerEnabled || !config.sportsHub) return;
    const latest = await publicClient.getBlockNumber();
    if (latest <= sportsTerminalizerLastScannedBlock) return;

    const fromBlock =
      sportsTerminalizerLastScannedBlock === 0n ? latest : sportsTerminalizerLastScannedBlock + 1n;
    for (const range of splitBlockRange({
      fromBlock,
      toBlock: latest,
      chunkSize: config.sportsTerminalizerScanChunkBlocks
    })) {
      await scanSportsTerminalizerRange(
        publicClient,
        config,
        range,
        scheduleSportsTerminalizerLogs
      );
      sportsTerminalizerLastScannedBlock = range.toBlock;
    }
  };

  const runScan = async () => {
    if (stopped || scanning) return;
    scanning = true;
    try {
      await scanMissedEvents();
      await scanMissedSportsTerminalizerEvents();
    } catch (error) {
      const message = (error as Error)?.message ?? "scan failed";
      logger.error("casino.keeper.scan_failed", { message });
      writeHealth(health.recordError(message, queue.size));
    } finally {
      scanning = false;
    }
  };

  const runBankProviderLedgerScan = async () => {
    if (stopped || bankProviderLedgerScanning) return;
    bankProviderLedgerScanning = true;
    try {
      await scanBankProviderLedgerEvents();
    } catch (error) {
      const message = (error as Error)?.message ?? "bank provider ledger scan failed";
      logger.error("casino.keeper.bank_provider_ledger_scan_failed", { message });
      writeHealth(health.recordError(message, queue.size));
    } finally {
      bankProviderLedgerScanning = false;
    }
  };

  const start = async () => {
    logger.info("casino.keeper.starting", {
      chainId: config.chainId,
      role: config.role,
      gameHub: config.gameHub,
      sportsHub: config.sportsHub,
      vrfHub: config.vrfHub,
      keeper: account.address,
      startBlock: lastScannedBlock.toString(),
      scanChunkBlocks: config.scanChunkBlocks.toString(),
      bankProviderLedgerPoolCount: config.bankProviderLedgerPools.length,
      bankProviderLedgerScanIntervalMs: config.bankProviderLedgerScanIntervalMs,
      sportsTicketIndexEnabled: config.sportsTicketIndexEnabled,
      sportsTerminalizerScanChunkBlocks: config.sportsTerminalizerScanChunkBlocks.toString(),
      sportsTerminalizerMarketIds: config.sportsTerminalizerMarketIds.map((id) => id.toString()),
      sportsTicketScanChunkBlocks: config.sportsTicketScanChunkBlocks.toString(),
      sportsTicketEnumerationMax: config.sportsTicketEnumerationMax,
      sportsTicketScanStartBlock: config.sportsTicketScanStartBlock.toString()
    });
    if (config.sportsTerminalizerEnabled && !config.sportsHub) {
      logger.warn("sports.terminalizer.disabled_missing_sports_hub");
    }
    writeHealth(health.recordStarted(lastScannedBlock, queue.size));
    await initializeBetIndex();

    if (wsClient) {
      unwatchers.push(
        wsClient.watchContractEvent({
          address: config.gameHub,
          abi: GAME_HUB_KEEPER_ABI,
          eventName: "BetRandomReady",
          onLogs: (logs) => {
            logs.forEach(enqueueBetRandomReadyLog);
            void writeBetIndexLogs("BetRandomReady", logs);
          },
          onError: (error) =>
            logger.error("casino.keeper.gamehub_watch_error", { message: error.message })
        })
      );
      if (betIndexStore) {
        for (const eventName of ["BetPlaced", "BetFinalized", "BetRefunded"] as const) {
          unwatchers.push(
            wsClient.watchContractEvent({
              address: config.gameHub,
              abi: GAME_HUB_KEEPER_ABI,
              eventName,
              onLogs: (logs) => void writeBetIndexLogs(eventName, logs),
              onError: (error) =>
                logger.error("casino.keeper.gamehub_index_watch_error", {
                  eventName,
                  message: error.message
                })
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
                  logger.error("casino.keeper.sports_ticket_index_watch_error", {
                    eventName,
                    message: error.message
                  })
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
              onError: (error) =>
                logger.error("sports.terminalizer.watch_error", {
                  eventName,
                  message: error.message
                })
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
          onError: (error) =>
            logger.error("casino.keeper.vrfhub_watch_error", { message: error.message })
        })
      );
    }

    timers.push(setInterval(() => void drainQueue(), 500));
    timers.push(setInterval(() => void runScan(), config.pollIntervalMs));
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
    void runScan();
    void runBankProviderLedgerScan();
    for (const marketId of config.sportsTerminalizerMarketIds) {
      scheduleSportsMarket(marketId, "ResultFinalized");
    }
    writeHealth(health.recordRunning(lastScannedBlock, queue.size));
  };

  const stop = async () => {
    stopped = true;
    timers.forEach(clearInterval);
    sportsMarketTimers.forEach(({ timer }) => clearTimeout(timer));
    sportsMarketTimers.clear();
    unwatchers.forEach((unwatch) => unwatch());
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
      await store.writeGameHubEvents(events);
    }
    if (config.sportsTicketIndexEnabled && config.sportsHub) {
      for (const eventName of SPORTS_TICKET_EVENTS) {
        const logs = await publicClient.getContractEvents({
          address: config.sportsHub,
          abi: SPORTS_HUB_KEEPER_ABI,
          eventName,
          fromBlock: range.fromBlock,
          toBlock: range.toBlock
        });
        const events = logs
          .map((log) => toSportsTicketIndexEvent(config.chainId, config.sportsHub!, eventName, log))
          .filter((event): event is SportsTicketIndexEvent => Boolean(event));
        await store.writeSportsHubEvents(events);
      }
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
      message: (error as Error)?.message ?? "index scan failed",
      toBlock: range.toBlock.toString()
    });
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
      message: (error as Error)?.message ?? "bank provider ledger scan failed",
      toBlock: range.toBlock.toString()
    });
    throw error;
  }
}

async function scanSportsTerminalizerRange(
  publicClient: PublicClient,
  config: KeeperConfig,
  range: { fromBlock: bigint; toBlock: bigint },
  scheduleLogs: (
    eventName: SportsTerminalizerEventName,
    logs: Array<{ args?: { finalizesAt?: bigint | number; marketId?: bigint | number } }>
  ) => void
) {
  if (!config.sportsTerminalizerEnabled || !config.sportsHub) return;
  for (const eventName of SPORTS_TERMINALIZER_EVENTS) {
    const logs = await publicClient.getContractEvents({
      address: config.sportsHub,
      abi: SPORTS_HUB_KEEPER_ABI,
      eventName,
      fromBlock: range.fromBlock,
      toBlock: range.toBlock
    });
    scheduleLogs(eventName, logs);
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
