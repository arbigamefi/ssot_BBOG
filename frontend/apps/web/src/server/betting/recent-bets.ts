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
import { applyGameHubEventToBet, type BetRow, type GameHubEventName } from "@ssot/ssot/indexer";
import { loadEmbeddedRelease, type SSOTRelease } from "@ssot/ssot/release";

import { resolvePublicRpcUrl } from "../../app-shell/rpc";
import type { RecentBetsResponse } from "../../features/betting/recent-bets";

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
const DEFAULT_WINDOW_BLOCKS = 5_000;
const DEFAULT_CONFIRMATIONS = 2;
const DEFAULT_CACHE_TTL_MS = 8_000;

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

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function numberEnv(name: string, fallback: number) {
  const parsed = Number(cleanEnvValue(process.env[name]));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
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

export function normalizeGameId(gameId: string | undefined) {
  const value = cleanEnvValue(gameId);
  if (!value) return undefined;
  if (!/^0x[a-fA-F0-9]{64}$/i.test(value)) {
    throw new Error("gameId must be a 32-byte hex string.");
  }
  return `0x${value.slice(2).toLowerCase()}` as Hex;
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
  const windowBlocks = BigInt(numberEnv("RECENT_BETS_WINDOW_BLOCKS", DEFAULT_WINDOW_BLOCKS));
  const confirmations = BigInt(numberEnv("RECENT_BETS_CONFIRMATIONS", DEFAULT_CONFIRMATIONS));
  const cacheKey = [chainId, normalizedGameId ?? "*", normalizedLimit, windowBlocks].join(":");
  const cached = recentBetsCache.get(cacheKey);
  const timestamp = now();
  if (cached && cached.expiresAt > timestamp) {
    return { ...cached.response, cached: true };
  }

  const releaseResult = loadEmbeddedRelease(chainId);
  if (!releaseResult.ok) throw new Error(releaseResult.error);
  const release = releaseResult.release;
  const rpcUrl = resolveServerRpcUrl(chainId);
  if (!rpcUrl) throw new Error(`No RPC URL configured for chainId=${chainId}.`);

  const publicClient =
    client ??
    createPublicClient({
      chain: createChain(chainId, rpcUrl),
      transport: http(rpcUrl)
    });

  const latestBlock = await publicClient.getBlockNumber();
  const toBlock = latestBlock > confirmations ? latestBlock - confirmations : latestBlock;
  const releaseBlock = BigInt(release.meta?.blockNumber ?? 0);
  const windowStart = toBlock > windowBlocks ? toBlock - windowBlocks : 0n;
  const fromBlock = windowStart > releaseBlock ? windowStart : releaseBlock;
  const gameHub = getAddress(release.contracts.gameHub) as Address;
  const logs: Array<EventLogLike & { eventName: GameHubEventName }> = [];

  for (const eventName of GAME_HUB_EVENTS) {
    const eventLogs = (await publicClient.getLogs({
      address: gameHub,
      event: getEventAbi(eventName),
      fromBlock,
      toBlock
    })) as EventLogLike[];
    logs.push(...eventLogs.map((log) => ({ ...log, eventName })));
  }

  let rows = foldRecentBetLogs({ chainId, gameHub, logs });
  if (normalizedGameId) {
    rows = rows.filter((row) => row.gameId?.toLowerCase() === normalizedGameId);
  }

  const response: RecentBetsResponse = {
    schemaVersion: 1,
    cached: false,
    chainId,
    fromBlock: Number(fromBlock),
    generatedAt: timestamp,
    rows: rows.slice(0, normalizedLimit),
    source: "rpc-window",
    toBlock: Number(toBlock)
  };
  recentBetsCache.set(cacheKey, { expiresAt: timestamp + cacheTtlMs, response });
  return response;
}

export function recentBetsCacheSize() {
  return recentBetsCache.size;
}

export function clearRecentBetsCache() {
  recentBetsCache.clear();
}
