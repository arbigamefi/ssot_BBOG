import type { BetIndexStore, SportsMarketWork, SportsTicketIndexEvent } from "@ssot/bet-index";
import type { PublicClient } from "viem";
import { SPORTS_HUB_KEEPER_ABI } from "./abi.js";
import { describeError } from "./errors.js";
import { retryDelayMs } from "./finalizer.js";
import { splitBlockRange } from "./scan.js";
import { terminalizeSportsMarket, type SportsTerminalizerDeps } from "./sports-terminalizer.js";
import type { KeeperConfig, KeeperLogger } from "./types.js";

const MARKET_EVENTS = [
  "ResultProposed",
  "ResultFinalized",
  "MarketVoided",
  "ResultChallengeResolved"
] as const;
const TICKET_EVENTS = ["TicketPlaced", "TicketSettled", "TicketRefunded", "TicketVoided"] as const;

// Include the coverage origin so widening history cannot reuse a later checkpoint.
export const sportsCursorSources = (start: bigint) => ({
  markets: `sports-markets-v1:${start}`,
  tickets: `sports-tickets-v1:${start}`
});

export function createSportsRecovery({
  config,
  store,
  publicClient,
  deps,
  logger,
  now = Date.now
}: {
  config: KeeperConfig;
  store: BetIndexStore;
  publicClient: Pick<PublicClient, "getBlockNumber" | "getContractEvents">;
  deps: Omit<SportsTerminalizerDeps, "findTicketIds">;
  logger: KeeperLogger;
  now?: () => number;
}) {
  if (!config.sportsHub) throw new Error("Sports recovery requires a sportsHub release address");
  const scope = { chainId: config.chainId, sportsHub: config.sportsHub };
  const sources = sportsCursorSources(config.sportsTicketScanStartBlock);
  const origin = config.sportsTicketScanStartBlock - 1n;
  const pollMs = config.pollIntervalMs > 0 ? config.pollIntervalMs : 300_000;
  const roleDelay = config.role === "backup" ? config.backupDelayMs : 0;
  let stopped = false;
  let scanPromise: Promise<void> | undefined;
  let processPromise: Promise<void> | undefined;
  const timers: Array<ReturnType<typeof setInterval>> = [];
  let warnedCoverageMismatch = false;
  const reportError = (error: unknown) =>
    logger.error("sports.recovery.failed", { error: describeError(error) });

  async function enqueue(marketId: bigint, requiredBlock: bigint, finalizesAt?: number) {
    if (!config.sportsTerminalizerEnabled || stopped) return;
    await store.sportsRecovery.enqueue({
      ...scope,
      marketId,
      requiredBlock,
      coverageStartBlock: config.sportsTicketScanStartBlock,
      availableAt: Math.max(now(), (finalizesAt ?? 0) * 1000) + roleDelay
    });
  }

  async function scanTickets(latest: bigint) {
    const cursor =
      (await store.getCursor(scope.chainId, sources.tickets, scope.sportsHub)) ?? origin;
    const fromBlock = cursor + 1n;
    const budgetEnd = fromBlock + config.sportsTicketScanMaxBlocks - 1n;
    const ranges = splitBlockRange({
      fromBlock,
      toBlock: latest < budgetEnd ? latest : budgetEnd,
      chunkSize: config.sportsTicketScanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass
    });
    for (const range of ranges) {
      if (stopped) return;
      const eventNames = config.sportsTicketIndexEnabled
        ? TICKET_EVENTS
        : (["TicketPlaced"] as const);
      for (const eventName of eventNames) {
        if (stopped) return;
        const logs = await publicClient.getContractEvents({
          address: scope.sportsHub,
          abi: SPORTS_HUB_KEEPER_ABI,
          eventName,
          ...range
        });
        if (eventName === "TicketPlaced") {
          const tickets = logs.map((log) => {
            const args = log.args as { marketId?: bigint; ticketId?: bigint };
            if (args.marketId == null || args.ticketId == null)
              throw new Error("Incomplete TicketPlaced log");
            return { marketId: args.marketId, ticketId: args.ticketId };
          });
          await store.sportsRecovery.writeTickets(scope, tickets);
        }
        if (config.sportsTicketIndexEnabled) {
          await store.writeSportsHubEvents(
            logs.map((log) => {
              if (log.blockNumber == null || log.transactionHash == null || log.logIndex == null) {
                throw new Error("Incomplete sports index log");
              }
              return {
                ...scope,
                eventName,
                args: log.args,
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
                logIndex: log.logIndex
              } as SportsTicketIndexEvent;
            })
          );
        }
      }
      // Writes precede the cursor. A crash between these operations replays safely.
      if (stopped) return;
      await store.setCursor({
        chainId: scope.chainId,
        cursorKey: scope.sportsHub,
        source: sources.tickets,
        blockNumber: range.toBlock
      });
    }
    reportCap("sports-ticket-history", ranges.at(-1)?.toBlock, latest);
  }

  async function scanMarkets(latest: bigint) {
    if (!config.sportsTerminalizerEnabled) return;
    const cursor =
      (await store.getCursor(scope.chainId, sources.markets, scope.sportsHub)) ?? origin;
    const ranges = splitBlockRange({
      fromBlock: cursor + 1n,
      toBlock: latest,
      chunkSize: config.sportsTerminalizerScanChunkBlocks,
      maxChunks: config.scanMaxChunksPerPass
    });
    for (const range of ranges) {
      if (stopped) return;
      for (const eventName of MARKET_EVENTS) {
        if (stopped) return;
        const logs = await publicClient.getContractEvents({
          address: scope.sportsHub,
          abi: SPORTS_HUB_KEEPER_ABI,
          eventName,
          ...range
        });
        for (const log of logs) {
          const args = log.args as { marketId?: bigint; finalizesAt?: bigint | number };
          if (args.marketId == null || log.blockNumber == null)
            throw new Error("Incomplete sports market log");
          await enqueue(
            args.marketId,
            log.blockNumber,
            args.finalizesAt == null ? undefined : Number(args.finalizesAt)
          );
        }
      }
      // Pending work is durable before an event becomes eligible to be skipped.
      if (stopped) return;
      await store.setCursor({
        chainId: scope.chainId,
        cursorKey: scope.sportsHub,
        source: sources.markets,
        blockNumber: range.toBlock
      });
    }
    reportCap("sports-terminalizer", ranges.at(-1)?.toBlock, latest);
  }

  function reportCap(scanner: string, through: bigint | undefined, head: bigint) {
    if (through != null && through < head)
      logger.info("casino.keeper.scan_capped", {
        scanner,
        scannedThrough: String(through),
        headBlock: String(head),
        remainingBlocks: String(head - through)
      });
  }

  function scan() {
    if (stopped) return Promise.resolve();
    if (scanPromise) return scanPromise;
    scanPromise = (async () => {
      const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
      // Independent cursors: neither a casino checkpoint nor a market checkpoint
      // is evidence that TicketPlaced history has been read.
      await scanTickets(latest);
      await scanMarkets(latest);
    })().finally(() => {
      scanPromise = undefined;
    });
    return scanPromise;
  }

  async function processWork(work: SportsMarketWork) {
    if (work.coverageStartBlock < config.sportsTicketScanStartBlock) {
      if (!warnedCoverageMismatch)
        logger.warn("sports.recovery.coverage_origin_mismatch", {
          requiredStart: String(work.coverageStartBlock),
          configuredStart: String(config.sportsTicketScanStartBlock)
        });
      warnedCoverageMismatch = true;
      return;
    }
    if (work.coverageStartBlock > config.sportsTicketScanStartBlock) {
      // A wider historical scan can discover ticket IDs before an old page
      // cursor. Reset pagination before trusting the new coverage origin.
      await enqueue(work.marketId, work.requiredBlock);
      return;
    }
    let page: bigint[] = [];
    let complete = false;
    const outcome = await terminalizeSportsMarket(work.marketId, {
      ...deps,
      findTicketIds: async () => {
        // ResultProposed requires Locked; all triggering events stop ticket placement.
        // A finite persisted barrier avoids chasing the chain head between scans.
        const required = work.requiredBlock;
        const covered =
          (await store.getCursor(scope.chainId, sources.tickets, scope.sportsHub)) ?? origin;
        if (covered < required)
          throw new Error(`Ticket history incomplete: covered ${covered}, need ${required}`);
        const ids = await store.sportsRecovery.ticketPage(
          scope,
          work.marketId,
          work.ticketCursor,
          config.sportsTerminalizerMaxTicketsPerMarket + 1
        );
        complete = ids.length <= config.sportsTerminalizerMaxTicketsPerMarket;
        page = ids.slice(0, config.sportsTerminalizerMaxTicketsPerMarket);
        return page;
      }
    });
    const successfulPage =
      outcome.kind === "terminalized" ||
      (outcome.kind === "skipped" && outcome.reason === "no-tickets");
    const attempts = outcome.kind === "failed" ? Math.min(work.attempts + 1, 8) : 0;
    let availableAt = now() + pollMs;
    if (successfulPage) availableAt = now() + roleDelay;
    else if (outcome.kind === "failed")
      availableAt = now() + retryDelayMs(work.attempts) + roleDelay;
    else if (outcome.finalizesAt != null)
      availableAt = Math.max(now() + 1000, outcome.finalizesAt * 1000) + roleDelay;
    await store.sportsRecovery.checkpoint(work, {
      complete: successfulPage && complete,
      ticketCursor: successfulPage ? (page.at(-1) ?? work.ticketCursor) : work.ticketCursor,
      availableAt,
      attempts
    });
    logger.info("sports.terminalizer.outcome", {
      marketId: String(work.marketId),
      outcome,
      complete: successfulPage && complete,
      attempts
    });
  }

  function runDue() {
    if (stopped || !config.sportsTerminalizerEnabled) return Promise.resolve();
    if (processPromise) return processPromise;
    processPromise = (async () => {
      // One bounded page per turn; oldest due time rotates markets fairly.
      const [work] = await store.sportsRecovery.due(scope, now(), 1);
      if (work) await processWork(work);
    })().finally(() => {
      processPromise = undefined;
    });
    return processPromise;
  }

  let prepared = false;
  async function prepare() {
    if (prepared) return;
    const manual: Array<{ marketId: bigint; requiredBlock: bigint }> = [];
    if (config.sportsTerminalizerEnabled) {
      for (const marketId of config.sportsTerminalizerMarketIds) {
        const market = await deps.readMarket(marketId);
        if (
          !["locked", "resultProposed", "challenged", "resolved", "voided"].includes(market.state)
        ) {
          throw new Error(
            `Manual sports recovery market ${marketId} still accepts tickets or does not exist`
          );
        }
        manual.push({
          marketId,
          requiredBlock: await publicClient.getBlockNumber({ cacheTime: 0 })
        });
      }
    }
    for (const work of manual) await enqueue(work.marketId, work.requiredBlock);
    prepared = true;
  }

  return {
    enqueue,
    scan,
    runDue,
    prepare,
    async start() {
      await prepare();
      timers.push(setInterval(() => void scan().catch(reportError), pollMs));
      if (config.sportsTerminalizerEnabled) {
        timers.push(setInterval(() => void runDue().catch(reportError), 1000));
        void runDue().catch(reportError);
      }
      if (config.startupScanEnabled) void scan().catch(reportError);
    },
    async stop() {
      stopped = true;
      timers.forEach(clearInterval);
      await Promise.allSettled([scanPromise, processPromise]);
    }
  };
}
