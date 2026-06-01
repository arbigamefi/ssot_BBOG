import {
  createPublicClient,
  createWalletClient,
  defineChain,
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
  const publicClient = createPublicClient({
    chain,
    transport: http(config.httpRpcUrl)
  });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.httpRpcUrl)
  });
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
  let lastScannedBlock = config.startBlock ?? 0n;
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
      if (resumeBlock > lastScannedBlock) {
        const configuredStartBlock = lastScannedBlock;
        lastScannedBlock = resumeBlock;
        logger.info("casino.keeper.bet_index_cursor_resumed", {
          configuredStartBlock: configuredStartBlock.toString(),
          cursorBlock: resumeBlock.toString()
        });
        writeHealth(health.recordStarted(lastScannedBlock, queue.size));
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
        if (config.sportsHub) {
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
    timers.push(setInterval(() => writeHealth(health.recordHeartbeat(queue.size)), 10_000));
    void runScan();
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
    if (config.sportsHub) {
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

export function resolveBetIndexResumeBlock(currentStartBlock: bigint, cursorBlock: bigint | null) {
  return cursorBlock != null && cursorBlock > currentStartBlock ? cursorBlock : currentStartBlock;
}
