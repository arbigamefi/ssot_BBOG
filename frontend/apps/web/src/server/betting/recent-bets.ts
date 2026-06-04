import {
  createPublicClient,
  decodeEventLog,
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

import type {
  AffiliateBetsResponse,
  BetReceiptResponse,
  PlayerBetsResponse,
  RecentBetsResponse
} from "../../features/betting/recent-bets";
import { resolveServerRpcUrl } from "../rpc";

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

const GAME_HUB_GET_BET_ABI = parseAbi([
  "function getBet(uint256 betId) view returns ((uint256 betId, bytes32 gameId, address player, address asset, address bank, uint256 stake, uint256 reserved, uint256 amountPerRoll, uint32 betCount, uint256 stopGain, uint256 stopLoss, address pricingAffiliate, uint16 baseHouseEdgeBps, uint16 effectiveHouseEdgeBps, uint16 maxHouseEdgeBps, uint32 referralConfigId, bytes32 deltaSkylineHash, bytes32 snapshotHash, bytes32 paramsHash, uint256 vrfFeePaid, uint256 vrfFeeCharged, uint32 vrfCallbackGasLimit, uint256 requestId, bytes32 randomHash, uint64 placedAt, uint64 vrfRequestedAt, uint64 resolvedAt, uint8 state))"
]);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_PLAYER_LIMIT = 100;
const MAX_PLAYER_LIMIT = 500;
const DEFAULT_AFFILIATE_LIMIT = 100;
const MAX_AFFILIATE_LIMIT = 500;
const DEFAULT_WINDOW_BLOCKS = 200;
const DEFAULT_PLAYER_WINDOW_BLOCKS = 500;
const DEFAULT_AFFILIATE_WINDOW_BLOCKS = 1_000;
const DEFAULT_RECEIPT_WINDOW_BLOCKS = 100_000;
const DEFAULT_LOG_CHUNK_BLOCKS = 10;
const DEFAULT_RECEIPT_LOG_CHUNK_BLOCKS = 2_000;
const DEFAULT_LOG_CONCURRENCY = 12;
const DEFAULT_RECEIPT_LOG_CONCURRENCY = 4;
const DEFAULT_CONFIRMATIONS = 2;
const DEFAULT_CACHE_TTL_MS = 8_000;
const DEFAULT_RECENT_RPC_TIMEOUT_MS = 4_000;
const DEFAULT_PLAYER_RPC_TIMEOUT_MS = 6_000;
const DEFAULT_RECEIPT_RPC_TIMEOUT_MS = 8_000;

type EventLogLike = {
  blockNumber?: bigint | null;
  blockTimestamp?: bigint | number | null;
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

function shouldUseRpcFallback(name: string, durableStoreEnabled: boolean) {
  const scoped = cleanEnvValue(process.env[name]);
  const global = cleanEnvValue(process.env.BET_INDEX_RPC_FALLBACK_ENABLED);
  const value = scoped ?? global;
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

export function clampAffiliateBetsLimit(limit: number | undefined) {
  if (!Number.isFinite(limit) || !limit || limit <= 0) return DEFAULT_AFFILIATE_LIMIT;
  return Math.min(MAX_AFFILIATE_LIMIT, Math.max(1, Math.floor(limit)));
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

export function normalizeAffiliateAddress(affiliate: string | undefined) {
  const value = cleanEnvValue(affiliate);
  if (!value) throw new Error("affiliate address is required.");
  try {
    return getAddress(value);
  } catch {
    throw new Error("affiliate must be a valid address.");
  }
}

export function normalizeBetId(value: string | undefined) {
  const normalized = cleanEnvValue(value);
  if (!normalized) throw new Error("betId is required.");
  try {
    const parsed = BigInt(normalized);
    if (parsed < 0n) throw new Error("negative");
    return parsed.toString();
  } catch {
    throw new Error("betId must be a non-negative integer.");
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
    const next = applyGameHubEventToBet(rows.get(key), event);
    const timestamp = blockTimestampMs(log.blockTimestamp);
    if (timestamp != null) {
      if (event.eventName === "BetPlaced") next.placedAt = timestamp;
      next.updatedAt = timestamp;
    }
    rows.set(key, next);
  }

  return [...rows.values()].sort((a, b) => b.updatedBlock - a.updatedBlock);
}

function blockTimestampMs(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value) * 1000;
  if (typeof value === "number" && Number.isFinite(value)) return value * 1000;
  return undefined;
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

  const durableStoreEnabled = Boolean(getDurableBetIndexStore());
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
  if (!shouldUseRpcFallback("RECENT_BETS_RPC_FALLBACK_ENABLED", durableStoreEnabled)) {
    const response = emptyRecentBetsResponse({
      chainId,
      generatedAt: now(),
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
        if (fromBlock > toBlock) {
          return emptyRecentBetsResponse({
            chainId,
            generatedAt: now(),
            source: "rpc-window"
          });
        }
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

export async function queryBetReceipt({
  betId,
  chainId,
  client,
  terminalTimestampMode = "block",
  terminalTxHash,
  now = () => Date.now()
}: {
  betId: string;
  chainId: number;
  client?: PublicClient;
  terminalTimestampMode?: "block" | "now";
  terminalTxHash?: Hex;
  now?: () => number;
}): Promise<BetReceiptResponse> {
  const normalizedBetId = normalizeBetId(betId);
  const store = getDurableBetIndexStore();
  const row = store ? await store.getBet({ betId: normalizedBetId, chainId }) : null;
  if (row) {
    return {
      schemaVersion: 1,
      betId: normalizedBetId,
      cached: false,
      chainId,
      generatedAt: now(),
      row,
      source: "postgres"
    };
  }

  if (shouldUseRpcFallback("BET_RECEIPT_RPC_FALLBACK_ENABLED", false)) {
    const directFallbackRow = terminalTxHash
      ? await queryBetReceiptTerminalTxFallback({
          betId: normalizedBetId,
          chainId,
          client,
          timestampMode: terminalTimestampMode,
          terminalTxHash,
          now
        })
      : null;
    if (directFallbackRow) {
      return {
        schemaVersion: 1,
        betId: normalizedBetId,
        cached: false,
        chainId,
        generatedAt: now(),
        row: directFallbackRow,
        source: "rpc-window"
      };
    }

    const fallbackRow = await queryBetReceiptRpcFallback({
      betId: normalizedBetId,
      chainId,
      client
    });
    return {
      schemaVersion: 1,
      betId: normalizedBetId,
      cached: false,
      chainId,
      generatedAt: now(),
      row: fallbackRow,
      source: "rpc-window"
    };
  }

  return {
    schemaVersion: 1,
    betId: normalizedBetId,
    cached: false,
    chainId,
    generatedAt: now(),
    row: null,
    source: store ? "postgres" : "rpc-window"
  };
}

async function queryBetReceiptTerminalTxFallback({
  betId,
  chainId,
  client,
  now,
  timestampMode,
  terminalTxHash
}: {
  betId: string;
  chainId: number;
  client?: PublicClient;
  now: () => number;
  timestampMode: "block" | "now";
  terminalTxHash: Hex;
}) {
  const receiptBetId = BigInt(betId);
  try {
    const loaded = await loadGameHubClient({ chainId, client });
    const [bet, txReceipt] = await Promise.all([
      loaded.client.readContract({
        address: loaded.gameHub,
        abi: GAME_HUB_GET_BET_ABI,
        functionName: "getBet",
        args: [receiptBetId]
      }) as Promise<any>,
      loaded.client.getTransactionReceipt({ hash: terminalTxHash })
    ]);
    const terminal = decodeTerminalReceiptLog({
      betId: receiptBetId,
      gameHub: loaded.gameHub,
      logs: txReceipt.logs
    });
    if (!terminal) return null;

    const blockTimestamp =
      timestampMode === "block" && txReceipt.blockNumber
        ? blockTimestampMs(
            (await loaded.client.getBlock({ blockNumber: txReceipt.blockNumber })).timestamp
          )
        : undefined;
    const updatedAt = blockTimestamp ?? now();
    const updatedBlock = txReceipt.blockNumber ? Number(txReceipt.blockNumber) : 0;
    const row: BetRow = {
      asset: getAddress(bet.asset) as Address,
      betId,
      chainId,
      gameId: bet.gameId as Hex,
      id: `${chainId}:${betId}`,
      lastEventName: terminal.eventName,
      lastTxHash: terminalTxHash,
      placedAt: numberSecondsToMs(bet.placedAt),
      player: getAddress(bet.player) as Address,
      pricingAffiliate: getAddress(bet.pricingAffiliate) as Address,
      randomHash: bet.randomHash as Hex,
      requestId: BigInt(bet.requestId).toString(),
      stake: BigInt(bet.stake).toString(),
      state: terminal.eventName === "BetRefunded" ? "refunded" : "finalized",
      terminalTxHash,
      updatedAt,
      updatedBlock
    };
    if (terminal.eventName === "BetFinalized") {
      row.finalizedTxHash = terminalTxHash;
      row.payoutGross = bigintStringFromUnknown(terminal.args.payoutGross);
      row.payout = bigintStringFromUnknown(terminal.args.payoutNet);
    } else {
      row.refundedTxHash = terminalTxHash;
      row.refundAmount = bigintStringFromUnknown(terminal.args.refundAmount);
      row.payout = row.refundAmount;
    }
    return row;
  } catch {
    return null;
  }
}

function decodeTerminalReceiptLog({
  betId,
  gameHub,
  logs
}: {
  betId: bigint;
  gameHub: Address;
  logs: Array<{ address?: Address; data: Hex; topics: readonly Hex[] }>;
}) {
  for (const log of logs) {
    if (log.address?.toLowerCase() !== gameHub.toLowerCase()) continue;
    for (const eventName of ["BetFinalized", "BetRefunded"] as const) {
      try {
        const decoded = decodeEventLog({
          abi: GAME_HUB_EVENT_ABI,
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

function numberSecondsToMs(value: unknown) {
  const numeric = Number(value ?? 0);
  return numeric > 0 ? numeric * 1000 : undefined;
}

function bigintStringFromUnknown(value: unknown) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return BigInt(value).toString();
  }
  return "0";
}

async function queryBetReceiptRpcFallback({
  betId,
  chainId,
  client
}: {
  betId: string;
  chainId: number;
  client?: PublicClient;
}) {
  const receiptBetId = BigInt(betId);
  const windowBlocks = bigintEnv("BET_RECEIPT_WINDOW_BLOCKS", DEFAULT_RECEIPT_WINDOW_BLOCKS);
  const confirmations = bigintEnv("BET_RECEIPT_CONFIRMATIONS", DEFAULT_CONFIRMATIONS);
  const chunkBlocks = bigintEnv("BET_RECEIPT_LOG_CHUNK_BLOCKS", DEFAULT_RECEIPT_LOG_CHUNK_BLOCKS);
  const logConcurrency = numberEnv("BET_RECEIPT_LOG_CONCURRENCY", DEFAULT_RECEIPT_LOG_CONCURRENCY);
  const rpcTimeoutMs = numberEnv("BET_RECEIPT_RPC_TIMEOUT_MS", DEFAULT_RECEIPT_RPC_TIMEOUT_MS);

  return withTimeout(
    (async () => {
      const loaded = await loadGameHubClient({ chainId, client });
      const { fromBlock, toBlock } = resolveBlockWindow({
        confirmations,
        latestBlock: loaded.latestBlock,
        release: loaded.release,
        windowBlocks
      });
      if (fromBlock > toBlock) return null;

      const placedLogs = await getGameHubLogsInChunks({
        args: { positionId: receiptBetId },
        chunkBlocks,
        concurrency: logConcurrency,
        client: loaded.client,
        eventName: "BetPlaced",
        fromBlock,
        gameHub: loaded.gameHub,
        toBlock
      });
      if (placedLogs.length === 0) return null;

      const placedFromBlock = placedLogs.reduce((min, log) => {
        const blockNumber = log.blockNumber ?? min;
        return blockNumber < min ? blockNumber : min;
      }, placedLogs[0]?.blockNumber ?? fromBlock);

      const logs: Array<EventLogLike & { eventName: GameHubEventName }> = [
        ...placedLogs.map((log) => ({ ...log, eventName: "BetPlaced" as const }))
      ];
      for (const eventName of ["BetRandomReady", "BetFinalized", "BetRefunded"] as const) {
        const eventLogs = await getGameHubLogsInChunks({
          args: { positionId: receiptBetId },
          chunkBlocks,
          concurrency: logConcurrency,
          client: loaded.client,
          eventName,
          fromBlock: placedFromBlock,
          gameHub: loaded.gameHub,
          toBlock
        });
        logs.push(...eventLogs.map((log) => ({ ...log, eventName })));
      }

      const timestampedLogs = await attachBlockTimestamps({
        client: loaded.client,
        concurrency: logConcurrency,
        logs
      });
      return (
        foldRecentBetLogs({ chainId, gameHub: loaded.gameHub, logs: timestampedLogs })[0] ?? null
      );
    })(),
    rpcTimeoutMs
  ).catch(() => null);
}

async function attachBlockTimestamps<T extends EventLogLike>({
  client,
  concurrency,
  logs
}: {
  client: PublicClient;
  concurrency: number;
  logs: T[];
}) {
  const blockNumbers = [
    ...new Set(logs.flatMap((log) => (log.blockNumber == null ? [] : [log.blockNumber])))
  ];
  if (blockNumbers.length === 0) return logs;

  const entries = await mapWithConcurrency(blockNumbers, concurrency, async (blockNumber) => {
    try {
      const block = await client.getBlock({ blockNumber });
      return [blockNumber.toString(), block.timestamp] as const;
    } catch {
      return [blockNumber.toString(), undefined] as const;
    }
  });
  const timestamps = new Map(entries.filter(([, timestamp]) => timestamp != null));
  return logs.map((log) => {
    if (log.blockNumber == null || log.blockTimestamp != null) return log;
    const blockTimestamp = timestamps.get(log.blockNumber.toString());
    return blockTimestamp == null ? log : { ...log, blockTimestamp };
  });
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

  const durableStoreEnabled = Boolean(getDurableBetIndexStore());
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
  if (!shouldUseRpcFallback("PLAYER_BETS_RPC_FALLBACK_ENABLED", durableStoreEnabled)) {
    const response = {
      ...emptyRecentBetsResponse({
        chainId,
        generatedAt: now(),
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
        if (fromBlock > toBlock) {
          return {
            ...emptyRecentBetsResponse({
              chainId,
              generatedAt: now(),
              source: "rpc-window"
            }),
            player: normalizedPlayer
          };
        }
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

export async function queryAffiliateBets({
  affiliate,
  chainId,
  limit,
  client,
  now = () => Date.now()
}: {
  affiliate: string;
  chainId: number;
  limit?: number;
  client?: PublicClient;
  now?: () => number;
}): Promise<AffiliateBetsResponse> {
  const normalizedLimit = clampAffiliateBetsLimit(limit);
  const normalizedAffiliate = normalizeAffiliateAddress(affiliate);
  const cacheTtlMs = numberEnv("AFFILIATE_BETS_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS);
  const windowBlocks = bigintEnv("AFFILIATE_BETS_WINDOW_BLOCKS", DEFAULT_AFFILIATE_WINDOW_BLOCKS);
  const confirmations = bigintEnv("AFFILIATE_BETS_CONFIRMATIONS", DEFAULT_CONFIRMATIONS);
  const chunkBlocks = bigintEnv("AFFILIATE_BETS_LOG_CHUNK_BLOCKS", DEFAULT_LOG_CHUNK_BLOCKS);
  const logConcurrency = numberEnv("AFFILIATE_BETS_LOG_CONCURRENCY", DEFAULT_LOG_CONCURRENCY);
  const rpcTimeoutMs = numberEnv("AFFILIATE_BETS_RPC_TIMEOUT_MS", DEFAULT_PLAYER_RPC_TIMEOUT_MS);
  const cacheKey = [
    "affiliate",
    chainId,
    normalizedAffiliate.toLowerCase(),
    normalizedLimit,
    windowBlocks,
    confirmations,
    chunkBlocks,
    logConcurrency,
    rpcTimeoutMs
  ].join(":");
  const cached = recentBetsCache.get(cacheKey);
  if (cached && cached.expiresAt > now()) {
    return { ...(cached.response as AffiliateBetsResponse), cached: true };
  }

  const durableStoreEnabled = Boolean(getDurableBetIndexStore());
  const [durableRows, durableStats] = await Promise.all([
    queryDurableAffiliateBets({
      affiliate: normalizedAffiliate,
      chainId,
      limit: normalizedLimit
    }),
    queryDurableAffiliateStats({ affiliate: normalizedAffiliate, chainId })
  ]);
  if (durableRows.length > 0 || (durableStoreEnabled && durableStats.betCount > 0)) {
    const generatedAt = now();
    const response = {
      ...responseFromRows({
        cached: false,
        chainId,
        generatedAt,
        rows: durableRows,
        source: "postgres"
      }),
      affiliate: normalizedAffiliate,
      stats: durableStats
    };
    recentBetsCache.set(cacheKey, { expiresAt: now() + cacheTtlMs, response });
    return response;
  }
  if (!shouldUseRpcFallback("AFFILIATE_BETS_RPC_FALLBACK_ENABLED", durableStoreEnabled)) {
    const response = {
      ...emptyRecentBetsResponse({
        chainId,
        generatedAt: now(),
        source: "postgres"
      }),
      affiliate: normalizedAffiliate,
      stats: emptyAffiliateStats(normalizedAffiliate)
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
        if (fromBlock > toBlock) {
          return {
            ...emptyRecentBetsResponse({
              chainId,
              generatedAt: now(),
              source: "rpc-window"
            }),
            affiliate: normalizedAffiliate,
            stats: emptyAffiliateStats(normalizedAffiliate)
          };
        }
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

        const rows = foldRecentBetLogs({ chainId, gameHub, logs }).filter(
          (row) => row.pricingAffiliate?.toLowerCase() === normalizedAffiliate.toLowerCase()
        );
        const generatedAt = now();
        const response: AffiliateBetsResponse = {
          schemaVersion: 1,
          cached: false,
          chainId,
          affiliate: normalizedAffiliate,
          fromBlock: Number(fromBlock),
          generatedAt,
          rows: rows.slice(0, normalizedLimit),
          source: "rpc-window",
          stats: affiliateStatsFromRows(normalizedAffiliate, rows),
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
      affiliate: normalizedAffiliate,
      stats: emptyAffiliateStats(normalizedAffiliate)
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

async function queryDurableAffiliateBets({
  affiliate,
  chainId,
  limit
}: {
  affiliate: Address;
  chainId: number;
  limit: number;
}) {
  const store = getDurableBetIndexStore();
  if (!store) return [];
  try {
    return await store.getAffiliateBets({ affiliate, chainId, limit });
  } catch {
    return [];
  }
}

async function queryDurableAffiliateStats({
  affiliate,
  chainId
}: {
  affiliate: Address;
  chainId: number;
}) {
  const store = getDurableBetIndexStore();
  if (!store) return emptyAffiliateStats(affiliate);
  try {
    return await store.getAffiliateStats({ affiliate, chainId });
  } catch {
    return emptyAffiliateStats(affiliate);
  }
}

function emptyAffiliateStats(affiliate: Address): AffiliateBetsResponse["stats"] {
  return {
    affiliate,
    betCount: 0,
    payout: "0",
    payoutGross: "0",
    settledCount: 0,
    turnover: "0"
  };
}

function affiliateStatsFromRows(
  affiliate: Address,
  rows: readonly BetRow[]
): AffiliateBetsResponse["stats"] {
  return rows.reduce<AffiliateBetsResponse["stats"]>((stats, row) => {
    stats.betCount += 1;
    if (row.state === "finalized" || row.state === "refunded") stats.settledCount += 1;
    stats.turnover = addStringBigints(stats.turnover, row.stake);
    stats.payout = addStringBigints(stats.payout, row.payout);
    stats.payoutGross = addStringBigints(stats.payoutGross, row.payoutGross);
    return stats;
  }, emptyAffiliateStats(affiliate));
}

function addStringBigints(left: string, right: string | undefined) {
  return (BigInt(left || "0") + BigInt(right || "0")).toString();
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
