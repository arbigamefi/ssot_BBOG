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
  type BetIndexStore
} from "@ssot/bet-index";

import { GAME_HUB_KEEPER_ABI, VRF_HUB_KEEPER_ABI } from "./abi.js";
import { finalizeIfReady, retryDelayMs } from "./finalizer.js";
import { createFileHealthSink, KeeperHealthReporter } from "./health.js";
import { FinalizeQueue, type QueueItem } from "./queue.js";
import { splitBlockRange } from "./scan.js";
import { mapBetState } from "./state.js";
import type { BetRead, KeeperConfig, KeeperEvent, KeeperLogger } from "./types.js";

type GameHubEventName = BetIndexEvent["eventName"];

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
  const unwatchers: Array<() => void> = [];
  let stopped = false;
  let scanning = false;
  let lastScannedBlock = config.startBlock ?? 0n;
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
      logIndex?: number;
      transactionHash?: Hex;
    }>
  ) => {
    if (!betIndexStore || logs.length === 0) return;
    const events = logs
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

  const runScan = async () => {
    if (stopped || scanning) return;
    scanning = true;
    try {
      await scanMissedEvents();
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
      vrfHub: config.vrfHub,
      keeper: account.address,
      startBlock: lastScannedBlock.toString(),
      scanChunkBlocks: config.scanChunkBlocks.toString()
    });
    writeHealth(health.recordStarted(lastScannedBlock, queue.size));
    if (betIndexStore) {
      betIndexStore
        .migrate()
        .then(() => logger.info("casino.keeper.bet_index_ready"))
        .catch((error) =>
          logger.error("casino.keeper.bet_index_migrate_failed", {
            message: (error as Error)?.message ?? "migration failed"
          })
        );
    }

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
    writeHealth(health.recordRunning(lastScannedBlock, queue.size));
  };

  const stop = async () => {
    stopped = true;
    timers.forEach(clearInterval);
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
      const events = logs
        .map((log) => toBetIndexEvent(config.chainId, config.gameHub, eventName, log))
        .filter((event): event is BetIndexEvent => Boolean(event));
      await store.writeGameHubEvents(events);
    }
    await store.setCursor({
      blockNumber: range.toBlock,
      chainId: config.chainId,
      cursorKey: config.gameHub,
      source: "gamehub-events"
    });
  } catch (error) {
    logger.error("casino.keeper.bet_index_scan_failed", {
      fromBlock: range.fromBlock.toString(),
      message: (error as Error)?.message ?? "index scan failed",
      toBlock: range.toBlock.toString()
    });
  }
}

function toBetIndexEvent(
  chainId: number,
  gameHub: Address,
  eventName: GameHubEventName,
  log: {
    args?: Record<string, unknown>;
    blockNumber?: bigint;
    logIndex?: number;
    transactionHash?: Hex;
  }
): BetIndexEvent | null {
  if (log.blockNumber == null || log.transactionHash == null || log.logIndex == null) return null;
  return {
    args: log.args ?? {},
    blockNumber: log.blockNumber,
    chainId,
    eventName,
    gameHub,
    logIndex: log.logIndex,
    txHash: log.transactionHash
  };
}
