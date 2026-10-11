import { createPublicClient, getAddress, http, type Address, type PublicClient } from "viem";
import {
  GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
  type BetIndexStore,
  type GameHubOperatorEvent,
  type GovernanceTimelockOperation
} from "@ssot/bet-index";
import { createSSOTSDK, decodeGovernanceCall, TIMELOCK_ROLE_NAMES, type Hex } from "@ssot/ssot/sdk";
import { loadEmbeddedRelease, type SSOTRelease } from "@ssot/ssot/release";

import type {
  DisabledGameView,
  GovernanceArgValue,
  GovernanceCallView,
  GovernanceCoverage,
  GovernanceOperationView,
  GovernanceQueueResponse,
  OpsGovernanceResponse,
  VoidWindowView
} from "../../features/governance/types";
import { getServerBetIndexStore } from "../bet-index-store";
import { resolveServerRpcUrl } from "../rpc";

/** An index this far behind may miss a schedule: the page says the list may be incomplete. */
export const GOVERNANCE_COVERAGE_STALE_MS = 60 * 60_000;
const RESPONSE_TTL_MS = 15_000;
const TIMELOCK_TTL_MS = 5 * 60_000;
const OPERATOR_EVENT_LIMIT = 200;

type Clock = () => number;

const responseCache = new Map<string, { expiresAt: number; response: unknown }>();
const timelockCache = new Map<string, { expiresAt: number; timelock: Address }>();

export function clearGovernanceQueueCache() {
  responseCache.clear();
  timelockCache.clear();
}

function createChainClient(chainId: number): PublicClient {
  const rpcUrl = resolveServerRpcUrl(chainId);
  if (!rpcUrl) throw new Error(`No RPC URL configured for chainId=${chainId}.`);
  return createPublicClient({
    chain: {
      id: chainId,
      name: `chain-${chainId}`,
      nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } }
    },
    transport: http(rpcUrl)
  }) as PublicClient;
}

/**
 * The release timelock, once the SDK has read it as PoolRegistry.governance() and GameHub.governance()
 * (ADR-0037 §2). A passed check is cached per release for TIMELOCK_TTL_MS.
 */
async function resolveTimelock(release: SSOTRelease, client: PublicClient, now: number) {
  const key = `${release.chainId}:${release.releaseDigest}`;
  const cached = timelockCache.get(key);
  if (cached && cached.expiresAt > now) return cached.timelock;
  const timelock = getAddress(
    await createSSOTSDK({ release, publicClient: client }).governance.getTimelock()
  );
  timelockCache.set(key, { timelock, expiresAt: now + TIMELOCK_TTL_MS });
  return timelock;
}

function serializeArg(value: unknown): GovernanceArgValue {
  if (typeof value === "bigint" || typeof value === "number") return value.toString();
  if (typeof value === "boolean" || typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(serializeArg);
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

const ROLE_FUNCTIONS = new Set(["grantRole", "revokeRole", "renounceRole"]);

export function describeGovernanceCall(
  release: SSOTRelease,
  target: Address,
  data: Hex
): GovernanceCallView {
  const decoded = decodeGovernanceCall(release, target, data);
  const call: GovernanceCallView = {
    target: decoded.target,
    contract: decoded.contract,
    ...(decoded.selector ? { selector: decoded.selector } : {})
  };
  if (!decoded.function) return call;
  call.function = {
    name: decoded.function.name,
    signature: decoded.function.signature,
    args: decoded.function.args.map((arg) => ({
      name: arg.name,
      type: arg.type,
      value: serializeArg(arg.value)
    }))
  };
  const role = decoded.function.args[0]?.value;
  if (ROLE_FUNCTIONS.has(decoded.function.name) && typeof role === "string") {
    const roleName = TIMELOCK_ROLE_NAMES[role.toLowerCase() as Hex];
    if (roleName) call.roleName = roleName;
  }
  return call;
}

function toOperationView(
  release: SSOTRelease,
  operation: GovernanceTimelockOperation
): GovernanceOperationView {
  return {
    operationId: operation.operationId,
    index: operation.index,
    state: operation.state,
    readyAt: Number(operation.readyAt),
    scheduledAt: operation.scheduledAt,
    scheduledTxHash: operation.scheduledTxHash,
    ...(operation.executedTxHash ? { executedTxHash: operation.executedTxHash } : {}),
    ...(operation.cancelledTxHash ? { cancelledTxHash: operation.cancelledTxHash } : {}),
    value: operation.value,
    call: describeGovernanceCall(release, getAddress(operation.target), operation.data)
  };
}

async function readCoverage({
  store,
  client,
  chainId,
  timelock,
  now
}: {
  store: BetIndexStore;
  client: PublicClient;
  chainId: number;
  timelock: Address;
  now: number;
}): Promise<GovernanceCoverage> {
  const cursor = await store.getCursor(chainId, GOVERNANCE_TIMELOCK_CURSOR_SOURCE, timelock);
  if (cursor == null) return { indexedThroughBlock: null, indexedThroughAt: null, stale: true };
  const block = await client.getBlock({ blockNumber: cursor });
  const indexedThroughAt = Number(block.timestamp) * 1000;
  return {
    indexedThroughBlock: Number(cursor),
    indexedThroughAt,
    stale: now - indexedThroughAt > GOVERNANCE_COVERAGE_STALE_MS
  };
}

function unavailable(chainId: number, now: number): GovernanceQueueResponse {
  return {
    schemaVersion: 1,
    chainId,
    generatedAt: now,
    source: "unavailable",
    timelock: null,
    coverage: { indexedThroughBlock: null, indexedThroughAt: null, stale: true },
    operations: []
  };
}

type QueueDeps = {
  client?: PublicClient;
  store?: BetIndexStore | null;
  now?: Clock;
};

async function readQueue({
  chainId,
  pendingOnly,
  client: injectedClient,
  store: injectedStore,
  now = () => Date.now()
}: QueueDeps & { chainId: number; pendingOnly: boolean }) {
  const startedAt = now();
  const releaseResult = loadEmbeddedRelease(chainId);
  const store = injectedStore === undefined ? getServerBetIndexStore() : injectedStore;
  if (!releaseResult.ok || !store) return null;
  const release = releaseResult.release;
  const client = injectedClient ?? createChainClient(chainId);
  const timelock = await resolveTimelock(release, client, startedAt);
  const [operations, coverage] = await Promise.all([
    store.getGovernanceTimelockOperations({ chainId, timelock, pendingOnly, now: startedAt }),
    readCoverage({ store, client, chainId, timelock, now: startedAt })
  ]);
  return {
    release,
    store,
    timelock,
    response: {
      schemaVersion: 1 as const,
      chainId,
      generatedAt: startedAt,
      source: "postgres" as const,
      timelock,
      coverage,
      operations: operations.map((operation) => toOperationView(release, operation))
    }
  };
}

function cached<T>(key: string, now: number) {
  const entry = responseCache.get(key);
  return entry && entry.expiresAt > now ? (entry.response as T) : undefined;
}

/**
 * Waiting and ready timelock operations for LPs. Any failure reports "unavailable" rather than an
 * empty queue: "no change scheduled" must never stand in for "could not read".
 */
export async function queryGovernanceQueue(
  deps: QueueDeps & { chainId: number }
): Promise<GovernanceQueueResponse> {
  const now = deps.now ?? (() => Date.now());
  const key = `queue:${deps.chainId}`;
  const hit = cached<GovernanceQueueResponse>(key, now());
  if (hit) return hit;
  let response: GovernanceQueueResponse;
  try {
    response =
      (await readQueue({ ...deps, now, pendingOnly: true }))?.response ??
      unavailable(deps.chainId, now());
  } catch {
    response = unavailable(deps.chainId, now());
  }
  responseCache.set(key, { expiresAt: now() + RESPONSE_TTL_MS, response });
  return response;
}

function voidWindowView(
  event: Extract<GameHubOperatorEvent, { eventName: "VoidWindowOpened" }>
): VoidWindowView {
  return {
    poolId: Number(event.poolId),
    bank: getAddress(event.bank),
    cohortEnd: Number(event.cohortEnd),
    caller: getAddress(event.caller),
    blockNumber: event.blockNumber,
    ...(event.blockTimestamp == null ? {} : { blockTimestamp: event.blockTimestamp }),
    txHash: event.txHash
  };
}

function disabledGameView(
  event: Extract<GameHubOperatorEvent, { eventName: "GameDisabled" }>
): DisabledGameView {
  return {
    gameId: event.gameId,
    caller: getAddress(event.caller),
    blockNumber: event.blockNumber,
    ...(event.blockTimestamp == null ? {} : { blockTimestamp: event.blockTimestamp }),
    txHash: event.txHash
  };
}

/** Every timelock operation (executed and cancelled too) plus void windows and disabled games. */
export async function queryOpsGovernance(
  deps: QueueDeps & { chainId: number }
): Promise<OpsGovernanceResponse> {
  const now = deps.now ?? (() => Date.now());
  const key = `ops:${deps.chainId}`;
  const hit = cached<OpsGovernanceResponse>(key, now());
  if (hit) return hit;
  let response: OpsGovernanceResponse;
  try {
    const read = await readQueue({ ...deps, now, pendingOnly: false });
    if (!read) {
      response = { ...unavailable(deps.chainId, now()), voidWindows: [], disabledGames: [] };
    } else {
      const events = await read.store.getGameHubOperatorEvents({
        chainId: deps.chainId,
        gameHub: getAddress(read.release.contracts.gameHub),
        limit: OPERATOR_EVENT_LIMIT
      });
      response = {
        ...read.response,
        voidWindows: events.flatMap((event) =>
          event.eventName === "VoidWindowOpened" ? [voidWindowView(event)] : []
        ),
        disabledGames: events.flatMap((event) =>
          event.eventName === "GameDisabled" ? [disabledGameView(event)] : []
        )
      };
    }
  } catch {
    response = { ...unavailable(deps.chainId, now()), voidWindows: [], disabledGames: [] };
  }
  responseCache.set(key, { expiresAt: now() + RESPONSE_TTL_MS, response });
  return response;
}
