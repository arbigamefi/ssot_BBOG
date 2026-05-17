import {
  createPublicClient,
  getAddress,
  http,
  parseAbi,
  type AbiEvent,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import { createPostgresBetIndexStore, type BetIndexStore } from "@ssot/bet-index";
import { applyGameHubEventToBet, type BetRow, type GameHubEventName } from "@ssot/ssot/indexer";
import { loadEmbeddedRelease, type SSOTRelease } from "@ssot/ssot/release";

import { resolvePublicRpcUrl } from "../../app-shell/rpc";
import type { PlayerBetsResponse, RecentBetsResponse } from "../../features/betting/recent-bets";

const GAME_HUB_EVENTS: GameHubEventName[] = [
  "BetPlaced",
  "BetRandomReady",
  "BetFinalized",
  "BetRefunded"
];

const GAME_HUB_EVENT_ABI = parseAbi([
  "event BetPlaced(uint256 indexed positionId, bytes32 indexed gameId, address indexed player, uint64 poolId, address asset, address bank, uint256 stake, uint256 reserved, uint256 amountPerRoll, uint32 betCount, uint256 stopGain, uint256 stopLoss, uint256 vrfFeePaid, uint256 vrfFeeCharged, uint32 vrfCallbackGasLimit, uint256 requestId, bytes32 snapshotHash, bytes32 paramsHash, address pricingAffiliate, uint16 baseHouseEdgeBps, uint16 effectiveHouseEdgeBps, uint16 maxHouseEdgeBps, uint32 referralConfigId, bytes32 deltaSkylineHash)",
  "event BetRandomReady(uint256 indexed positionId, uint256 indexed requestId, bytes32 randomHash)",
  "event BetFinalized(uint256 indexed positionId, uint256 payoutGross, uint256 payoutNet, uint256 feeOnPayout, uint256 protocolFeeAccrual)",
  "event BetRefunded(uint256 indexed positionId, uint256 refundAmount)"
]);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_PLAYER_LIMIT = 100;
const MAX_PLAYER_LIMIT = 500;
const DEFAULT_WINDOW_BLOCKS = 200;
const DEFAULT_PLAYER_WINDOW_BLOCKS = 500;
const DEFAULT_LOG_CHUNK_BLOCKS = 10;
const DEFAULT_LOG_CONCURRENCY = 12;
const DEFAULT_CONFIRMATIONS = 2;
const DEFAULT_CACHE_TTL_MS = 8_000;
const DEFAULT_RECENT_RPC_TIMEOUT_MS = 4_000;
const DEFAULT_PLAYER_RPC_TIMEOUT_MS = 6_000;

type EventLogLike = {
  blockNumber?: bigint | null;
  logIndex?: number | null;
  transactionHash?: Hex | null;
  args?: Record<string, unknown>;
};

type RecentBetsCacheEntry = {
  expiresAt: number;
  response: RecentBetsResponse;
};

const recentBetsCache = new Map<string, RecentBetsCacheEntry>();
let durableBetIndexStore: BetIndexStore | null | undefined;

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function numberEnv(name: string, fallback: number) {
  const parsed = Number(cleanEnvValue(process.env[name]));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function bigintEnv(name: string, fallback: number) {
  return BigInt(numberEnv(name, fallback));
}

function resolveServerRpcUrl(chainId: number) {
  return (
    cleanEnvValue(process.env.RPC_URL) ??
    cleanEnvValue(process.env.BASE_SEPOLIA_RPC_URL) ??
    cleanEnvValue(process.env.BASE_RPC_URL) ??
    cleanEnvValue(process.env.ARBITRUM_SEPOLIA_RPC_URL) ??
    cleanEnvValue(process.env.ARBITRUM_RPC_URL) ??
    resolvePublicRpcUrl(chainId)
  );
}

function isTruthyEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}

function isFalseyEnv(value: string | undefined) {
  return ["0", "false", "no", "off"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}

function getDurableBetIndexStore() {
  if (durableBetIndexStore !== undefined) return durableBetIndexStore;
  const connectionString = cleanEnvValue(process.env.BET_INDEX_DATABASE_URL);
  if (!connectionString || isFalseyEnv(process.env.BET_INDEX_READ_ENABLED)) {
    durableBetIndexStore = null;
    return durableBetIndexStore;
  }
  durableBetIndexStore = createPostgresBetIndexStore({
    connectionString,
    ssl: isTruthyEnv(process.env.BET_INDEX_SSL)
  });
  return durableBetIndexStore;
}

function getEventAbi(eventName: GameHubEventName) {
  const event = GAME_HUB_EVENT_ABI.find((item) => item.type === "event" && item.name === eventName);
  if (!event) throw new Error(`GameHub event ABI missing ${eventName}`);
  return event as AbiEvent;
}

function createChain(chainId: number, rpcUrl: string) {
  return {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  } as const;
}

export function clampRecentBetsLimit(limit: number | undefined) {
  if (!Number.isFinite(limit) || !limit || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

export function clampPlayerBetsLimit(limit: number | undefined) {
  if (!Number.isFinite(limit) || !limit || limit <= 0) return DEFAULT_PLAYER_LIMIT;
  return Math.min(MAX_PLAYER_LIMIT, Math.max(1, Math.floor(limit)));
}

export function normalizeGameId(gameId: string | undefined) {
  const value = cleanEnvValue(gameId);
  if (!value) return undefined;
  if (!/^0x[a-fA-F0-9]{64}$/i.test(value)) {
    throw new Error("gameId must be a 32-byte hex string.");
  }
  return `0x${value.slice(2).toLowerCase()}` as Hex;
}

export function normalizePlayerAddress(player: string | undefined) {
  const value = cleanEnvValue(player);
  if (!value) throw new Error("player address is required.");
  try {
    return getAddress(value);
  } catch {
    throw new Error("player must be a valid address.");
  }
}

export function foldRecentBetLogs({
  chainId,
  gameHub,
  logs
}: {
  chainId: number;
  gameHub: Address;
  logs: Array<EventLogLike & { eventName: GameHubEventName }>;
}) {
  const rows = new Map<string, BetRow>();
  const sorted = [...logs].sort((a, b) => {
    const blockDelta = Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n));
    if (blockDelta !== 0) return blockDelta;
    return Number(a.logIndex ?? 0) - Number(b.logIndex ?? 0);
  });

  for (const log of sorted) {
    if (!log.transactionHash || log.blockNumber == null) continue;
    const event = {
      args: log.args ?? {},
      blockNumber: Number(log.blockNumber),
      chainId,
      eventName: log.eventName,
      gameHub,
      logIndex: Number(log.logIndex ?? 0),
      txHash: log.transactionHash
    };
    const betId = String(event.args.positionId ?? event.args.betId ?? event.args.id ?? "0");
    const key = `${chainId}:${betId}`;
    rows.set(key, applyGameHubEventToBet(rows.get(key), event));
  }

  return [...rows.values()].sort((a, b) => b.updatedBlock - a.updatedBlock);
}

async function loadGameHubClient({
  chainId,
  client
}: {
  chainId: number;
  client?: PublicClient;
}): Promise<{
  client: PublicClient;
  gameHub: Address;
  latestBlock: bigint;
  release: SSOTRelease;
}> {
  const releaseResult = loadEmbeddedRelease(chainId);
  if (!releaseResult.ok) throw new Error(releaseResult.error);
  const release = releaseResult.release;
  let publicClient = client;
  if (!publicClient) {
    const rpcUrl = resolveServerRpcUrl(chainId);
    if (!rpcUrl) throw new Error(`No RPC URL configured for chainId=${chainId}.`);
    publicClient = createPublicClient({
      chain: createChain(chainId, rpcUrl),
      transport: http(rpcUrl)
    });
  }

  return {
    client: publicClient,
    gameHub: getAddress(release.contracts.gameHub) as Address,
    latestBlock: await publicClient.getBlockNumber(),
    release
  };
}

function resolveBlockWindow({
  latestBlock,
  release,
  windowBlocks,
  confirmations
}: {
  latestBlock: bigint;
  release: SSOTRelease;
  windowBlocks: bigint;
  confirmations: bigint;
}) {
  const toBlock = latestBlock > confirmations ? latestBlock - confirmations : latestBlock;
  const releaseBlock = BigInt(release.meta?.blockNumber ?? 0);
  const windowStart = toBlock > windowBlocks ? toBlock - windowBlocks : 0n;
  return {
    fromBlock: windowStart > releaseBlock ? windowStart : releaseBlock,
    toBlock
  };
}

function getBlockChunks({
  chunkBlocks,
  fromBlock,
  toBlock
}: {
  chunkBlocks: bigint;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  if (fromBlock > toBlock) return [];
  const chunks: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  const safeChunkBlocks = chunkBlocks > 0n ? chunkBlocks : BigInt(DEFAULT_LOG_CHUNK_BLOCKS);
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const end = cursor + safeChunkBlocks - 1n;
    const rangeToBlock = end < toBlock ? end : toBlock;
    chunks.push({ fromBlock: cursor, toBlock: rangeToBlock });
    cursor = rangeToBlock + 1n;
  }
  return chunks;
}

async function getGameHubLogsInChunks({
  args,
  chunkBlocks,
  concurrency,
  client,
  eventName,
  fromBlock,
  gameHub,
  toBlock
}: {
  args?: Record<string, unknown>;
  chunkBlocks: bigint;
  concurrency: number;
  client: PublicClient;
  eventName: GameHubEventName;
  fromBlock: bigint;
  gameHub: Address;
  toBlock: bigint;
}) {
  const chunks = getBlockChunks({ chunkBlocks, fromBlock, toBlock });
  const logsByChunk = await mapWithConcurrency(chunks, concurrency, async (range) => {
    const eventLogs = (await client.getLogs({
      address: gameHub,
      args,
      event: getEventAbi(eventName),
      fromBlock: range.fromBlock,
      toBlock: range.toBlock
    } as Parameters<PublicClient["getLogs"]>[0])) as EventLogLike[];
    return eventLogs;
  });
  return logsByChunk.flat();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  const workerCount = Math.min(safeConcurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("RPC fallback timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function queryRecentBets({
  chainId,
  gameId,
  limit,
  client,
  now = () => Date.now()
}: {
  chainId: number;
  gameId?: Hex;
  limit?: number;
  client?: PublicClient;
  now?: () => number;
}): Promise<RecentBetsResponse> {
  const normalizedLimit = clampRecentBetsLimit(limit);
  const normalizedGameId = normalizeGameId(gameId);
  const cacheTtlMs = numberEnv("RECENT_BETS_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS);
  const windowBlocks = bigintEnv("RECENT_BETS_WINDOW_BLOCKS", DEFAULT_WINDOW_BLOCKS);
  const confirmations = bigintEnv("RECENT_BETS_CONFIRMATIONS", DEFAULT_CONFIRMATIONS);
  const chunkBlocks = bigintEnv("RECENT_BETS_LOG_CHUNK_BLOCKS", DEFAULT_LOG_CHUNK_BLOCKS);
  const logConcurrency = numberEnv("RECENT_BETS_LOG_CONCURRENCY", DEFAULT_LOG_CONCURRENCY);
  const rpcTimeoutMs = numberEnv("RECENT_BETS_RPC_TIMEOUT_MS", DEFAULT_RECENT_RPC_TIMEOUT_MS);
  const cacheKey = [
    chainId,
    normalizedGameId ?? "*",
    normalizedLimit,
    windowBlocks,
    confirmations,
    chunkBlocks,
    logConcurrency,
    rpcTimeoutMs
  ].join(":");
  const cached = recentBetsCache.get(cacheKey);
  if (cached && cached.expiresAt > now()) {
    return { ...cached.response, cached: true };
  }

  const durableRows = await queryDurableRecentBets({
    chainId,
    gameId: normalizedGameId,
    limit: normalizedLimit
  });
  if (durableRows.length > 0) {
    const generatedAt = now();
    const response = responseFromRows({
      cached: false,
      chainId,
      generatedAt,
      rows: durableRows,
      source: "postgres"
    });
    recentBetsCache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  }

  try {
    const response = await withTimeout(
      (async () => {
        const loaded = await loadGameHubClient({ chainId, client });
        const { fromBlock, toBlock } = resolveBlockWindow({
          confirmations,
          latestBlock: loaded.latestBlock,
          release: loaded.release,
          windowBlocks
        });
        const gameHub = loaded.gameHub;
        const logs: Array<EventLogLike & { eventName: GameHubEventName }> = [];

        for (const eventName of GAME_HUB_EVENTS) {
          const eventLogs = await getGameHubLogsInChunks({
            chunkBlocks,
            concurrency: logConcurrency,
            client: loaded.client,
            eventName,
            fromBlock,
            gameHub,
            toBlock
          });
          logs.push(...eventLogs.map((log) => ({ ...log, eventName })));
        }

        let rows = foldRecentBetLogs({ chainId, gameHub, logs });
        if (normalizedGameId) {
          rows = rows.filter((row) => row.gameId?.toLowerCase() === normalizedGameId);
        }

        const generatedAt = now();
        const response: RecentBetsResponse = {
          schemaVersion: 1,
          cached: false,
          chainId,
          fromBlock: Number(fromBlock),
          generatedAt,
          rows: rows.slice(0, normalizedLimit),
          source: "rpc-window",
          toBlock: Number(toBlock)
        };
        return response;
      })(),
      rpcTimeoutMs
    );
    recentBetsCache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  } catch {
    const response = emptyRecentBetsResponse({
      chainId,
      generatedAt: now(),
      source: "rpc-window"
    });
    recentBetsCache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  }
}

export async function queryPlayerBets({
  chainId,
  player,
  limit,
  client,
  now = () => Date.now()
}: {
  chainId: number;
  player: string;
  limit?: number;
  client?: PublicClient;
  now?: () => number;
}): Promise<PlayerBetsResponse> {
  const normalizedLimit = clampPlayerBetsLimit(limit);
  const normalizedPlayer = normalizePlayerAddress(player);
  const cacheTtlMs = numberEnv("PLAYER_BETS_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS);
  const windowBlocks = bigintEnv("PLAYER_BETS_WINDOW_BLOCKS", DEFAULT_PLAYER_WINDOW_BLOCKS);
  const confirmations = bigintEnv("PLAYER_BETS_CONFIRMATIONS", DEFAULT_CONFIRMATIONS);
  const chunkBlocks = bigintEnv("PLAYER_BETS_LOG_CHUNK_BLOCKS", DEFAULT_LOG_CHUNK_BLOCKS);
  const logConcurrency = numberEnv("PLAYER_BETS_LOG_CONCURRENCY", DEFAULT_LOG_CONCURRENCY);
  const rpcTimeoutMs = numberEnv("PLAYER_BETS_RPC_TIMEOUT_MS", DEFAULT_PLAYER_RPC_TIMEOUT_MS);
  const cacheKey = [
    "player",
    chainId,
    normalizedPlayer.toLowerCase(),
    normalizedLimit,
    windowBlocks,
    confirmations,
    chunkBlocks,
    logConcurrency,
    rpcTimeoutMs
  ].join(":");
  const cached = recentBetsCache.get(cacheKey);
  if (cached && cached.expiresAt > now()) {
    return { ...(cached.response as PlayerBetsResponse), cached: true };
  }

  const durableRows = await queryDurablePlayerBets({
    chainId,
    limit: normalizedLimit,
    player: normalizedPlayer
  });
  if (durableRows.length > 0) {
    const generatedAt = now();
    const response = {
      ...responseFromRows({
        cached: false,
        chainId,
        generatedAt,
        rows: durableRows,
        source: "postgres"
      }),
      player: normalizedPlayer
    };
    recentBetsCache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  }

  try {
    const response = await withTimeout(
      (async () => {
        const loaded = await loadGameHubClient({ chainId, client });
        const { fromBlock, toBlock } = resolveBlockWindow({
          confirmations,
          latestBlock: loaded.latestBlock,
          release: loaded.release,
          windowBlocks
        });
        const gameHub = loaded.gameHub;

        const placedLogs = await getGameHubLogsInChunks({
          args: { player: normalizedPlayer },
          chunkBlocks,
          concurrency: logConcurrency,
          client: loaded.client,
          eventName: "BetPlaced",
          fromBlock,
          gameHub,
          toBlock
        });
        const betIds = new Set(
          placedLogs
            .map((log) => String(log.args?.positionId ?? log.args?.betId ?? log.args?.id ?? ""))
            .filter(Boolean)
        );
        const logs: Array<EventLogLike & { eventName: GameHubEventName }> = placedLogs.map(
          (log) => ({
            ...log,
            eventName: "BetPlaced"
          })
        );

        if (betIds.size > 0) {
          for (const eventName of GAME_HUB_EVENTS.filter((name) => name !== "BetPlaced")) {
            const eventLogs = await getGameHubLogsInChunks({
              chunkBlocks,
              concurrency: logConcurrency,
              client: loaded.client,
              eventName,
              fromBlock,
              gameHub,
              toBlock
            });
            logs.push(
              ...eventLogs
                .filter((log) =>
                  betIds.has(String(log.args?.positionId ?? log.args?.betId ?? log.args?.id ?? ""))
                )
                .map((log) => ({ ...log, eventName }))
            );
          }
        }

        const rows = foldRecentBetLogs({ chainId, gameHub, logs }).filter(
          (row) => row.player?.toLowerCase() === normalizedPlayer.toLowerCase()
        );
        const generatedAt = now();
        const response: PlayerBetsResponse = {
          schemaVersion: 1,
          cached: false,
          chainId,
          fromBlock: Number(fromBlock),
          generatedAt,
          player: normalizedPlayer,
          rows: rows.slice(0, normalizedLimit),
          source: "rpc-window",
          toBlock: Number(toBlock)
        };
        return response;
      })(),
      rpcTimeoutMs
    );
    recentBetsCache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  } catch {
    const response = {
      ...emptyRecentBetsResponse({
        chainId,
        generatedAt: now(),
        source: "rpc-window"
      }),
      player: normalizedPlayer
    };
    recentBetsCache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  }
}

async function queryDurableRecentBets({
  chainId,
  gameId,
  limit
}: {
  chainId: number;
  gameId?: Hex;
  limit: number;
}) {
  const store = getDurableBetIndexStore();
  if (!store) return [];
  try {
    return await store.getRecentBets({ chainId, gameId, limit });
  } catch {
    return [];
  }
}

async function queryDurablePlayerBets({
  chainId,
  limit,
  player
}: {
  chainId: number;
  limit: number;
  player: Address;
}) {
  const store = getDurableBetIndexStore();
  if (!store) return [];
  try {
    return await store.getPlayerBets({ chainId, limit, player });
  } catch {
    return [];
  }
}

function responseFromRows({
  cached,
  chainId,
  generatedAt,
  rows,
  source
}: {
  cached: boolean;
  chainId: number;
  generatedAt: number;
  rows: BetRow[];
  source: RecentBetsResponse["source"];
}): RecentBetsResponse {
  const blocks = rows.map((row) => row.updatedBlock);
  return {
    schemaVersion: 1,
    cached,
    chainId,
    fromBlock: blocks.length ? Math.min(...blocks) : 0,
    generatedAt,
    rows,
    source,
    toBlock: blocks.length ? Math.max(...blocks) : 0
  };
}

function emptyRecentBetsResponse({
  chainId,
  generatedAt,
  source
}: {
  chainId: number;
  generatedAt: number;
  source: RecentBetsResponse["source"];
}): RecentBetsResponse {
  return {
    schemaVersion: 1,
    cached: false,
    chainId,
    fromBlock: 0,
    generatedAt,
    rows: [],
    source,
    toBlock: 0
  };
}

export function recentBetsCacheSize() {
  return recentBetsCache.size;
}

export function clearRecentBetsCache() {
  recentBetsCache.clear();
}
