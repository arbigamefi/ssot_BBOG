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
import {
  createPostgresBetIndexStore,
  foldSportsTicketIndexEvents,
  type BetIndexStore,
  type SportsHubEventName,
  type SportsTicketIndexEvent,
  type SportsTicketRow
} from "@ssot/bet-index";
import { loadEmbeddedRelease, type SSOTRelease } from "@ssot/ssot/release";

import { resolvePublicRpcUrl } from "../../app-shell/rpc";
import type { PlayerSportsTicketsResponse } from "../../features/sportsbook/recent-tickets";
import { normalizePlayerAddress, clampPlayerBetsLimit } from "../betting/recent-bets";

const SPORTS_TICKET_EVENTS: SportsHubEventName[] = [
  "TicketPlaced",
  "TicketSettled",
  "TicketRefunded",
  "TicketVoided"
];

const SPORTS_TICKET_EVENT_ABI = parseAbi([
  "event TicketPlaced(uint256 indexed ticketId, uint256 indexed positionId, uint64 indexed marketId, uint64 eventId, uint64 poolId, uint32 outcomeId, address player, uint256 stake, uint256 payout, uint256 reserved, bytes32 oddsSnapshotHash, bytes32 rulebookHash)",
  "event TicketSettled(uint256 indexed ticketId, uint256 indexed positionId, uint256 payout)",
  "event TicketRefunded(uint256 indexed ticketId, uint256 indexed positionId, uint256 refundAmount)",
  "event TicketVoided(uint256 indexed ticketId, uint256 indexed positionId, uint256 refundAmount)"
]);

const DEFAULT_WINDOW_BLOCKS = 1_500;
const DEFAULT_LOG_CHUNK_BLOCKS = 10;
const DEFAULT_LOG_CONCURRENCY = 8;
const DEFAULT_CONFIRMATIONS = 2;
const DEFAULT_CACHE_TTL_MS = 8_000;
const DEFAULT_RPC_TIMEOUT_MS = 6_000;

type EventLogLike = {
  blockNumber?: bigint | null;
  logIndex?: number | null;
  transactionHash?: Hex | null;
  args?: Record<string, unknown>;
};

type PlayerSportsTicketsCacheEntry = {
  expiresAt: number;
  response: PlayerSportsTicketsResponse;
};

const cache = new Map<string, PlayerSportsTicketsCacheEntry>();
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

function shouldUseRpcFallback(durableStoreEnabled: boolean) {
  const value =
    cleanEnvValue(process.env.SPORTS_TICKETS_RPC_FALLBACK_ENABLED) ??
    cleanEnvValue(process.env.BET_INDEX_RPC_FALLBACK_ENABLED);
  if (value !== undefined) return isTruthyEnv(value);
  return !durableStoreEnabled;
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

function getEventAbi(eventName: SportsHubEventName) {
  const event = SPORTS_TICKET_EVENT_ABI.find(
    (item) => item.type === "event" && item.name === eventName
  );
  if (!event) throw new Error(`SportsHub event ABI missing ${eventName}`);
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

async function loadSportsHubClient({
  chainId,
  client
}: {
  chainId: number;
  client?: PublicClient;
}): Promise<{
  client: PublicClient;
  latestBlock: bigint;
  release: SSOTRelease;
  sportsHub: Address;
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
  const sportsHub = release.contracts.sportsHub;
  if (!sportsHub) throw new Error(`Release for chainId=${chainId} does not include SportsHub.`);

  return {
    client: publicClient,
    latestBlock: await publicClient.getBlockNumber(),
    release,
    sportsHub: getAddress(sportsHub) as Address
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

async function getSportsHubLogsInChunks({
  chunkBlocks,
  concurrency,
  client,
  eventName,
  fromBlock,
  sportsHub,
  toBlock
}: {
  chunkBlocks: bigint;
  concurrency: number;
  client: PublicClient;
  eventName: SportsHubEventName;
  fromBlock: bigint;
  sportsHub: Address;
  toBlock: bigint;
}) {
  const chunks = getBlockChunks({ chunkBlocks, fromBlock, toBlock });
  const logsByChunk = await mapWithConcurrency(chunks, concurrency, async (range) => {
    const eventLogs = (await client.getLogs({
      address: sportsHub,
      event: getEventAbi(eventName),
      fromBlock: range.fromBlock,
      toBlock: range.toBlock
    } as Parameters<PublicClient["getLogs"]>[0])) as EventLogLike[];
    return eventLogs;
  });
  return logsByChunk.flat();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Sports ticket RPC fallback timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function toSportsTicketIndexEvent(
  chainId: number,
  sportsHub: Address,
  eventName: SportsHubEventName,
  log: EventLogLike
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

function emptyResponse({
  chainId,
  generatedAt,
  player,
  source
}: {
  chainId: number;
  generatedAt: number;
  player: string;
  source: PlayerSportsTicketsResponse["source"];
}): PlayerSportsTicketsResponse {
  return {
    schemaVersion: 1,
    cached: false,
    chainId,
    fromBlock: 0,
    generatedAt,
    player,
    rows: [],
    source,
    toBlock: 0
  };
}

function responseFromRows({
  cached,
  chainId,
  generatedAt,
  player,
  rows,
  source
}: {
  cached: boolean;
  chainId: number;
  generatedAt: number;
  player: string;
  rows: SportsTicketRow[];
  source: PlayerSportsTicketsResponse["source"];
}): PlayerSportsTicketsResponse {
  const blocks = rows.map((row) => row.updatedBlock);
  return {
    schemaVersion: 1,
    cached,
    chainId,
    fromBlock: blocks.length ? Math.min(...blocks) : 0,
    generatedAt,
    player,
    rows,
    source,
    toBlock: blocks.length ? Math.max(...blocks) : 0
  };
}

async function queryDurablePlayerSportsTickets({
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
    return await store.getPlayerSportsTickets({ chainId, limit, player });
  } catch {
    return [];
  }
}

export async function queryPlayerSportsTickets({
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
}): Promise<PlayerSportsTicketsResponse> {
  const normalizedLimit = clampPlayerBetsLimit(limit);
  const normalizedPlayer = normalizePlayerAddress(player);
  const cacheTtlMs = numberEnv("SPORTS_TICKETS_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS);
  const windowBlocks = bigintEnv("SPORTS_TICKETS_WINDOW_BLOCKS", DEFAULT_WINDOW_BLOCKS);
  const confirmations = bigintEnv("SPORTS_TICKETS_CONFIRMATIONS", DEFAULT_CONFIRMATIONS);
  const chunkBlocks = bigintEnv("SPORTS_TICKETS_LOG_CHUNK_BLOCKS", DEFAULT_LOG_CHUNK_BLOCKS);
  const logConcurrency = numberEnv("SPORTS_TICKETS_LOG_CONCURRENCY", DEFAULT_LOG_CONCURRENCY);
  const rpcTimeoutMs = numberEnv("SPORTS_TICKETS_RPC_TIMEOUT_MS", DEFAULT_RPC_TIMEOUT_MS);
  const cacheKey = [
    "sports-player",
    chainId,
    normalizedPlayer.toLowerCase(),
    normalizedLimit,
    windowBlocks,
    confirmations,
    chunkBlocks,
    logConcurrency,
    rpcTimeoutMs
  ].join(":");
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now()) {
    return { ...cached.response, cached: true };
  }

  const durableStoreEnabled = Boolean(getDurableBetIndexStore());
  const durableRows = await queryDurablePlayerSportsTickets({
    chainId,
    limit: normalizedLimit,
    player: normalizedPlayer
  });
  if (durableRows.length > 0) {
    const response = responseFromRows({
      cached: false,
      chainId,
      generatedAt: now(),
      player: normalizedPlayer,
      rows: durableRows,
      source: "postgres"
    });
    cache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  }

  if (!shouldUseRpcFallback(durableStoreEnabled)) {
    const response = emptyResponse({
      chainId,
      generatedAt: now(),
      player: normalizedPlayer,
      source: "postgres"
    });
    cache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  }

  try {
    const response = await withTimeout(
      (async () => {
        const loaded = await loadSportsHubClient({ chainId, client });
        const { fromBlock, toBlock } = resolveBlockWindow({
          confirmations,
          latestBlock: loaded.latestBlock,
          release: loaded.release,
          windowBlocks
        });
        if (fromBlock > toBlock) {
          return emptyResponse({
            chainId,
            generatedAt: now(),
            player: normalizedPlayer,
            source: "rpc-window"
          });
        }

        const placedLogs = await getSportsHubLogsInChunks({
          chunkBlocks,
          concurrency: logConcurrency,
          client: loaded.client,
          eventName: "TicketPlaced",
          fromBlock,
          sportsHub: loaded.sportsHub,
          toBlock
        });
        const playerPlacedLogs = placedLogs.filter(
          (log) => String(log.args?.player ?? "").toLowerCase() === normalizedPlayer.toLowerCase()
        );
        const ticketIds = new Set(
          playerPlacedLogs.map((log) => String(log.args?.ticketId ?? "")).filter(Boolean)
        );
        const events: SportsTicketIndexEvent[] = playerPlacedLogs
          .map((log) => toSportsTicketIndexEvent(chainId, loaded.sportsHub, "TicketPlaced", log))
          .filter((event): event is SportsTicketIndexEvent => Boolean(event));

        if (ticketIds.size > 0) {
          for (const eventName of SPORTS_TICKET_EVENTS.filter((name) => name !== "TicketPlaced")) {
            const eventLogs = await getSportsHubLogsInChunks({
              chunkBlocks,
              concurrency: logConcurrency,
              client: loaded.client,
              eventName,
              fromBlock,
              sportsHub: loaded.sportsHub,
              toBlock
            });
            events.push(
              ...eventLogs
                .filter((log) => ticketIds.has(String(log.args?.ticketId ?? "")))
                .map((log) => toSportsTicketIndexEvent(chainId, loaded.sportsHub, eventName, log))
                .filter((event): event is SportsTicketIndexEvent => Boolean(event))
            );
          }
        }

        const rows = foldSportsTicketIndexEvents(events)
          .filter((row) => row.player?.toLowerCase() === normalizedPlayer.toLowerCase())
          .slice(0, normalizedLimit);
        return {
          ...responseFromRows({
            cached: false,
            chainId,
            generatedAt: now(),
            player: normalizedPlayer,
            rows,
            source: "rpc-window"
          }),
          fromBlock: Number(fromBlock),
          toBlock: Number(toBlock)
        };
      })(),
      rpcTimeoutMs
    );
    cache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  } catch {
    const response = emptyResponse({
      chainId,
      generatedAt: now(),
      player: normalizedPlayer,
      source: "rpc-window"
    });
    cache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  }
}

export function clearPlayerSportsTicketsCache() {
  cache.clear();
}
