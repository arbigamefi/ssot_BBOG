import {
  createPublicClient,
  getAddress,
  http,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import {
  createMemoryBetIndexStore,
  createPostgresBetIndexStore,
  enrichFinalizedBetEvents,
  type BetIndexEvent,
  type BetIndexStore
} from "@ssot/bet-index";

import { GAME_HUB_KEEPER_ABI } from "./abi.js";
import {
  fetchBankProviderLedgerRows,
  type BankProviderLedgerPool
} from "./bank-provider-ledger.js";
import { loadRelease } from "./env.js";
import { logger } from "./logger.js";
import { splitBlockRange } from "./scan.js";

type BackfillConfig = {
  chainId: number;
  gameHub: Address;
  httpRpcUrl: string;
  databaseUrl?: string;
  databaseSsl: boolean;
  dryRun: boolean;
  fromBlock: bigint;
  toBlock?: bigint;
  confirmations: bigint;
  scanChunkBlocks: bigint;
  releasePath: string;
  bankProviderLedgerPools: BankProviderLedgerPool[];
};

const GAME_HUB_INDEX_EVENTS = [
  "BetPlaced",
  "BetRandomReady",
  "BetFinalized",
  "BetRefunded"
] as const satisfies readonly BetIndexEvent["eventName"][];

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requireEnv(env: NodeJS.ProcessEnv, key: string) {
  const value = cleanEnvValue(env[key]);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function parseBool(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}

function parseBlock(value: string | undefined) {
  const valueToParse = cleanEnvValue(value);
  return valueToParse == null ? undefined : BigInt(valueToParse);
}

function parsePositiveBlock(value: string | undefined, fallback: bigint, name: string) {
  const parsed = parseBlock(value) ?? fallback;
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero`);
  return parsed;
}

function resolveRpcUrl(env: NodeJS.ProcessEnv) {
  return cleanEnvValue(env.KEEPER_RPC_HTTP);
}

export function loadBackfillConfig(env: NodeJS.ProcessEnv = process.env): BackfillConfig {
  const releasePath = requireEnv(env, "KEEPER_RELEASE_PATH");
  const release = loadRelease(releasePath);
  const chainId = Number(env.KEEPER_CHAIN_ID ?? release.chainId);
  if (chainId !== release.chainId) {
    throw new Error(`KEEPER_CHAIN_ID=${chainId} does not match release chainId=${release.chainId}`);
  }

  const dryRun = parseBool(env.BET_INDEX_DRY_RUN);
  const databaseUrl = cleanEnvValue(env.BET_INDEX_DATABASE_URL);
  if (!dryRun && !databaseUrl) {
    throw new Error("BET_INDEX_DATABASE_URL is required unless BET_INDEX_DRY_RUN=true");
  }

  const releaseBlock = BigInt(release.meta?.blockNumber ?? 0);
  return {
    bankProviderLedgerPools: (release.pools ?? [])
      .filter((pool) => pool.active !== false)
      .map((pool) => ({
        asset: getAddress(pool.asset),
        bank: getAddress(pool.bank),
        decimals: pool.decimals ?? 6,
        poolId: pool.poolId
      })),
    chainId,
    databaseSsl: parseBool(env.BET_INDEX_SSL),
    databaseUrl,
    dryRun,
    fromBlock:
      parseBlock(env.BET_INDEX_FROM_BLOCK) ?? parseBlock(env.KEEPER_START_BLOCK) ?? releaseBlock,
    gameHub: getAddress(release.contracts.gameHub),
    httpRpcUrl: resolveRpcUrl(env) ?? requireEnv(env, "KEEPER_RPC_HTTP"),
    releasePath,
    scanChunkBlocks: parsePositiveBlock(
      env.BET_INDEX_SCAN_CHUNK_BLOCKS ?? env.KEEPER_SCAN_CHUNK_BLOCKS,
      10n,
      "BET_INDEX_SCAN_CHUNK_BLOCKS"
    ),
    confirmations: parseBlock(env.BET_INDEX_CONFIRMATIONS) ?? 2n,
    toBlock: parseBlock(env.BET_INDEX_TO_BLOCK)
  };
}

export function resolveBackfillRange({
  confirmations,
  fromBlock,
  latestBlock,
  toBlock
}: {
  confirmations: bigint;
  fromBlock: bigint;
  latestBlock: bigint;
  toBlock?: bigint;
}) {
  const confirmedLatest = latestBlock > confirmations ? latestBlock - confirmations : latestBlock;
  const resolvedToBlock = toBlock == null || toBlock > confirmedLatest ? confirmedLatest : toBlock;
  if (resolvedToBlock < fromBlock) {
    throw new Error(
      `BET_INDEX_TO_BLOCK (${resolvedToBlock}) is before BET_INDEX_FROM_BLOCK (${fromBlock})`
    );
  }
  return { fromBlock, toBlock: resolvedToBlock };
}

export async function runBetIndexBackfill({
  client,
  config,
  store
}: {
  client?: PublicClient;
  config: BackfillConfig;
  store?: BetIndexStore;
}) {
  const publicClient =
    client ??
    createPublicClient({
      transport: http(config.httpRpcUrl)
    });
  const indexStore =
    store ??
    (config.dryRun
      ? createMemoryBetIndexStore()
      : createPostgresBetIndexStore({
          connectionString: config.databaseUrl as string,
          ssl: config.databaseSsl
        }));

  try {
    await indexStore.migrate();
    const latestBlock = await publicClient.getBlockNumber();
    const range = resolveBackfillRange({
      confirmations: config.confirmations,
      fromBlock: config.fromBlock,
      latestBlock,
      toBlock: config.toBlock
    });

    let eventCount = 0;
    let rowCount = 0;
    let bankProviderLedgerRowCount = 0;
    for (const chunk of splitBlockRange({
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
      chunkSize: config.scanChunkBlocks
    })) {
      for (const eventName of GAME_HUB_INDEX_EVENTS) {
        const logs = await publicClient.getContractEvents({
          address: config.gameHub,
          abi: GAME_HUB_KEEPER_ABI,
          eventName,
          fromBlock: chunk.fromBlock,
          toBlock: chunk.toBlock
        });
        const stampedLogs = await attachBlockTimestamps(publicClient, logs);
        const events = stampedLogs
          .map((log) =>
            toBetIndexEvent(config.chainId, config.gameHub, eventName, {
              args: log.args,
              blockNumber: log.blockNumber,
              blockTimestamp: log.blockTimestamp,
              logIndex: log.logIndex,
              transactionHash: log.transactionHash
            })
          )
          .filter((event): event is BetIndexEvent => Boolean(event));
        eventCount += events.length;
        rowCount += (
          await indexStore.writeGameHubEvents(await enrichFinalizedBetEvents(publicClient, events))
        ).length;
      }
      for (const pool of config.bankProviderLedgerPools) {
        const rows = await fetchBankProviderLedgerRows({
          chainId: config.chainId,
          pool,
          publicClient,
          range: chunk
        });
        bankProviderLedgerRowCount += (await indexStore.writeBankProviderLedgerRows(rows)).length;
      }
      await indexStore.setCursor({
        blockNumber: chunk.toBlock,
        chainId: config.chainId,
        cursorKey: config.gameHub,
        source: "gamehub-events"
      });
    }

    const recent = await indexStore.getRecentBets({ chainId: config.chainId, limit: 5 });
    return {
      chainId: config.chainId,
      dryRun: config.dryRun,
      eventCount,
      bankProviderLedgerRowCount,
      fromBlock: range.fromBlock.toString(),
      gameHub: config.gameHub,
      recent,
      rowCount,
      toBlock: range.toBlock.toString()
    };
  } finally {
    await indexStore.close?.();
  }
}

function toBetIndexEvent(
  chainId: number,
  gameHub: Address,
  eventName: BetIndexEvent["eventName"],
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

async function main() {
  const config = loadBackfillConfig();
  logger.info("casino.keeper.bet_index_backfill_starting", {
    chainId: config.chainId,
    dryRun: config.dryRun,
    fromBlock: config.fromBlock.toString(),
    gameHub: config.gameHub,
    releasePath: config.releasePath,
    scanChunkBlocks: config.scanChunkBlocks.toString(),
    toBlock: config.toBlock?.toString()
  });
  const result = await runBetIndexBackfill({ config });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("backfill.js")) {
  main().catch((error) => {
    logger.error("casino.keeper.bet_index_backfill_failed", {
      message: (error as Error)?.message ?? "unknown error"
    });
    process.exit(1);
  });
}
