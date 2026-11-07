import type { PublicClient, Address, Abi, AbiEvent } from "viem";
import { getAddress } from "viem";
import { readSettledBetRefund } from "@ssot/bet-index/terminal-refund";
import type { SSOTRelease } from "../release/schema";
import { getContractAbis } from "../abis/index.mjs";
import type { SSOTDb } from "./store";
import type { GameHubEventName, GameHubEventNormalized } from "./reduce";
import { applyGameHubEventToBet } from "./reduce";
import { createBlockClock } from "./blockClock";

/** Durations are seconds, turned into blocks at the measured block rate; only `batchSize` counts blocks. */
export interface GameHubIndexerConfig {
  /** Blocks younger than this wait for a later pass. */
  confirmationSeconds: number;
  pollIntervalMs: number;
  /** Integer blocks per eth_getLogs, at least 5 to cover a whole Base second; the public RPC takes 201. */
  batchSize: number;
  /**
   * Each pass rereads this much chain before its cursor, replacing what a shallow reorg changed. A reread placement
   * sets its bet back to placed until the bet's later events are reread: a pass that stops in between leaves it so
   * until a later pass gets past them.
   */
  rewindSeconds: number;
  /**
   * A browser without a cursor starts this long before the target, not at the release block: the server's bet index
   * holds the history, and this index only adds the newest events for the player's own view. Events in it of bets
   * placed earlier get their players from the placements, found by each bet's own placement second.
   */
  initialLookbackSeconds: number;
}

export interface GameHubIndexerStatus {
  chainId: number;
  gameHub: Address;
  lastSyncedBlock?: number;
  latestBlock?: number;
  /** The newest block old enough to index at the last pass: latest minus the confirmation blocks. */
  targetBlock?: number;
  blocksPerSecond?: number;
  lastRunAt?: number;
  lastError?: string;
}

export interface GameHubIndexer {
  start(): void;
  stop(): void;
  syncOnce(): Promise<void>;
  getStatus(): GameHubIndexerStatus;
}

export const GAME_HUB_INDEXER_DEFAULTS: GameHubIndexerConfig = {
  confirmationSeconds: 24,
  pollIntervalMs: 10_000,
  batchSize: 200,
  rewindSeconds: 48,
  initialLookbackSeconds: 3_600
};

const GAME_HUB_EVENTS: GameHubEventName[] = [
  "BetPlaced",
  "BetRandomReady",
  "BetFinalized",
  "BetRefunded",
  "BetVoided"
];

export function createGameHubIndexer(params: {
  release: SSOTRelease;
  publicClient: PublicClient;
  db: SSOTDb;
  config?: Partial<GameHubIndexerConfig>;
}): GameHubIndexer {
  const { release, publicClient, db } = params;
  const config: GameHubIndexerConfig = { ...GAME_HUB_INDEXER_DEFAULTS, ...(params.config ?? {}) };
  if (!Number.isInteger(config.batchSize) || config.batchSize < 5)
    throw new Error("GameHub indexer batchSize must be an integer of at least 5 blocks");
  const gameHub = getAddress(release.contracts.gameHub) as Address;
  const clock = createBlockClock(publicClient);
  /** The block and timestamp the cursor was last set to, so the next rewind needs no read for it. */
  let lastTarget: { number: bigint; timestamp: bigint } | undefined;
  /** Placements found for bets placed before a batch, kept until the batch is stored so its retry reuses them. */
  const placements = new Map<string, GameHubEventNormalized>();
  /** The poll timer fires every pollIntervalMs however long a pass takes; a call during a pass joins it. */
  let pass: Promise<void> | undefined;
  let oldPlayersRecovered = false;

  const status: GameHubIndexerStatus = { chainId: release.chainId, gameHub };
  let timer: any | undefined;

  function syncOnce(): Promise<void> {
    pass ??= sync().finally(() => {
      pass = undefined;
    });
    return pass;
  }

  async function sync(): Promise<void> {
    try {
      status.lastRunAt = Date.now();
      status.lastError = undefined;

      const head = await clock.latest();
      const latestBlock = Number(head.number);
      status.latestBlock = latestBlock;
      status.blocksPerSecond = clock.blocksPerSecond;

      // The measured rate estimates the confirmation; the target block's own timestamp guarantees it.
      const estimate = Math.max(0, latestBlock - clock.blocks(config.confirmationSeconds));
      const target =
        estimate === latestBlock
          ? head
          : await clock.atOrBefore(
              head.timestamp - BigInt(config.confirmationSeconds),
              BigInt(estimate),
              0n
            );
      if (!target) return;
      const targetBlock = Number(target.number);
      status.targetBlock = targetBlock;

      // Older browsers may already have terminal rows without players, outside the rewind. Repair just those
      // cached rows once per indexer, even with no new events. Preserve their terminal facts and the tx journal.
      // A failed lookup leaves that row untouched and retries next pass, before advancing the cursor.
      if (!oldPlayersRecovered) {
        const missing = await db.bets
          .where("chainId")
          .equals(release.chainId)
          .filter((row) => row.gameHub.toLowerCase() === gameHub.toLowerCase() && !row.player)
          .toArray();
        const { GameHubAbi } = getContractAbis();
        for (const row of missing) {
          const placement = await findPlacement(GameHubAbi as Abi, row.betId, row.updatedBlock);
          await db.bets.update(row.id, { player: placement.args.player as Address });
          placements.delete(row.betId);
        }
        oldPlayersRecovered = true;
      }

      const cursorId = `${release.chainId}:${gameHub}`;
      const cursor = await db.cursors.get(cursorId);

      const releaseStartBlock = Number(release.meta?.blockNumber ?? 0);

      let fromBlock = cursor ? cursor.lastProcessedBlock + 1 : releaseStartBlock;
      if (!cursor && config.initialLookbackSeconds > 0) {
        const start = await clock.atOrBefore(
          target.timestamp - BigInt(config.initialLookbackSeconds),
          BigInt(
            Math.max(releaseStartBlock, targetBlock - clock.blocks(config.initialLookbackSeconds))
          ),
          BigInt(releaseStartBlock)
        );
        if (start) fromBlock = Math.max(releaseStartBlock, Number(start.number));
      }
      if (cursor && config.rewindSeconds > 0) {
        // Reread from a block at least rewindSeconds older than the cursor's, checked like the target.
        const cursorTime =
          lastTarget && Number(lastTarget.number) === cursor.lastProcessedBlock
            ? lastTarget.timestamp
            : (await publicClient.getBlock({ blockNumber: BigInt(cursor.lastProcessedBlock) }))
                .timestamp;
        const start = await clock.atOrBefore(
          cursorTime - BigInt(config.rewindSeconds),
          BigInt(
            Math.max(
              releaseStartBlock,
              cursor.lastProcessedBlock - clock.blocks(config.rewindSeconds) + 1
            )
          ),
          BigInt(releaseStartBlock)
        );
        fromBlock = start ? Math.max(releaseStartBlock, Number(start.number)) : releaseStartBlock;
      }

      if (fromBlock > targetBlock) {
        status.lastSyncedBlock = cursor?.lastProcessedBlock ?? releaseStartBlock;
        return;
      }

      // Batch to avoid provider limits. The cursor follows each batch, so a long first pass resumes after a reload.
      for (let start = fromBlock; start <= targetBlock; start += config.batchSize) {
        const end = Math.min(targetBlock, start + config.batchSize - 1);
        await syncRange(start, end);
        await db.cursors.put({
          id: cursorId,
          chainId: release.chainId,
          source: gameHub,
          lastProcessedBlock: end,
          updatedAt: Date.now()
        });
        status.lastSyncedBlock = end;
      }
      lastTarget = target;
    } catch (e: any) {
      status.lastError = e?.message ? String(e.message) : String(e);
    }
  }

  async function syncRange(fromBlock: number, toBlock: number): Promise<void> {
    const { GameHubAbi } = getContractAbis();
    const gameHubAbi = GameHubAbi as Abi;

    const logsAll: GameHubEventNormalized[] = [];

    // One query for all five events: the RPC matches any of their topics.
    const logs = await publicClient.getLogs({
      address: gameHub,
      events: GAME_HUB_EVENTS.map((eventName) => getEventAbi(gameHubAbi, eventName)),
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock)
    });
    for (const log of logs as any[]) {
      const eventName = log.eventName as GameHubEventName;
      if (!GAME_HUB_EVENTS.includes(eventName)) continue;
      const logIndex = Number(log.logIndex ?? 0);
      const args = { ...(log.args ?? {}) };
      if (eventName === "BetFinalized") {
        const betId = args.positionId;
        if (betId == null) throw new Error("finalized event missing bet ID");
        args.refundAmount = await readSettledBetRefund({
          client: publicClient,
          gameHub,
          betId: BigInt(betId),
          args
        });
      }
      logsAll.push({
        chainId: release.chainId,
        gameHub,
        blockNumber: Number(log.blockNumber),
        logIndex,
        txHash: log.transactionHash,
        eventName,
        args
      });
    }

    // A bet placed before this batch can get its random, settlement, refund (which has no deadline) or void here,
    // and those events do not name the player. Its placement is applied first, so no stored bet lacks its player;
    // when it is not found the batch fails, the cursor stays, and the next pass retries.
    const placed = new Set(
      logsAll.filter((ev) => ev.eventName === "BetPlaced").map((ev) => extractBetIdString(ev.args))
    );
    const recovered: string[] = [];
    for (const ev of logsAll.slice()) {
      const betId = extractBetIdString(ev.args);
      if (placed.has(betId)) continue;
      placed.add(betId);
      if ((await db.bets.get(`${release.chainId}:${betId}`))?.player) continue;
      logsAll.push(await findPlacement(gameHubAbi, betId, ev.blockNumber));
      recovered.push(betId);
    }

    // deterministic order
    logsAll.sort((a, b) => {
      const d = a.blockNumber - b.blockNumber;
      if (d !== 0) return d;
      const li = (a.logIndex ?? 0) - (b.logIndex ?? 0);
      if (li !== 0) return li;
      return a.txHash > b.txHash ? 1 : a.txHash < b.txHash ? -1 : 0;
    });

    if (logsAll.length === 0) return;

    await db.transaction("rw", db.gameHubEvents, db.bets, async () => {
      for (const ev of logsAll) {
        const rowId = `${ev.chainId}:${ev.txHash}:${ev.logIndex ?? 0}`;
        const argsJson = safeJson(ev.args);
        await db.gameHubEvents.put({
          id: rowId,
          chainId: ev.chainId,
          gameHub,
          blockNumber: ev.blockNumber,
          txHash: ev.txHash,
          logIndex: ev.logIndex ?? 0,
          eventName: ev.eventName,
          argsJson,
          createdAt: Date.now()
        });

        const betKey = `${ev.chainId}:${extractBetIdString(ev.args)}`;
        const prev = await db.bets.get(betKey);
        const next = applyGameHubEventToBet(prev, ev);
        await db.bets.put(next);
      }
    });
    for (const betId of recovered) placements.delete(betId);
  }

  /**
   * The placement of a bet placed no later than block `before`. The bet records its placement second, and Base makes
   * at most five blocks a second, so the placement is among the batch-size blocks up to the last block of that second.
   * Throws unless exactly one placement of the bet, naming its player, is there.
   */
  async function findPlacement(
    gameHubAbi: Abi,
    betId: string,
    before: number
  ): Promise<GameHubEventNormalized> {
    const known = placements.get(betId);
    if (known) return known;
    const bet = (await publicClient.readContract({
      address: gameHub,
      abi: gameHubAbi,
      functionName: "getBet",
      args: [BigInt(betId)]
    })) as { placedAt?: bigint | number } | undefined;
    const placedAt = BigInt(bet?.placedAt ?? 0);
    const releaseStartBlock = BigInt(release.meta?.blockNumber ?? 0);
    const last =
      placedAt > 0n
        ? await clock.atOrBefore(placedAt, BigInt(before), releaseStartBlock)
        : undefined;
    if (!last) throw new Error(`bet ${betId} has no placement time`);
    const start = last.number - BigInt(config.batchSize) + 1n;
    const logs = await publicClient.getLogs({
      address: gameHub,
      event: getEventAbi(gameHubAbi, "BetPlaced"),
      args: { positionId: BigInt(betId) },
      fromBlock: start > releaseStartBlock ? start : releaseStartBlock,
      toBlock: last.number
    } as any);
    const matches = (logs as any[]).filter(
      (log) => log.eventName === "BetPlaced" && extractBetIdString(log.args ?? {}) === betId
    );
    const log = matches[0];
    if (matches.length !== 1 || !log.args.player)
      throw new Error(`bet ${betId} placement not found`);
    const placement: GameHubEventNormalized = {
      chainId: release.chainId,
      gameHub,
      blockNumber: Number(log.blockNumber),
      logIndex: Number(log.logIndex ?? 0),
      txHash: log.transactionHash,
      eventName: "BetPlaced",
      args: { ...log.args }
    };
    placements.set(betId, placement);
    return placement;
  }

  function start(): void {
    if (timer) return;
    timer = setInterval(() => {
      void syncOnce();
    }, config.pollIntervalMs);
    void syncOnce();
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  function getStatus(): GameHubIndexerStatus {
    return { ...status };
  }

  return { start, stop, syncOnce, getStatus };
}

function getEventAbi(abi: Abi, eventName: string): AbiEvent {
  const item = abi.find((x: any) => x?.type === "event" && x?.name === eventName);
  if (!item) throw new Error(`GameHub ABI missing event ${eventName}`);
  return item as any;
}

function safeJson(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

function extractBetIdString(args: Record<string, unknown>): string {
  const raw = (args as any).positionId ?? (args as any).betId ?? (args as any).id ?? "0";
  if (typeof raw === "bigint") return raw.toString();
  if (typeof raw === "number") return BigInt(raw).toString();
  if (typeof raw === "string") {
    if (raw.startsWith("0x")) {
      try {
        return BigInt(raw).toString();
      } catch {
        return "0";
      }
    }
    return raw;
  }
  return String(raw);
}
