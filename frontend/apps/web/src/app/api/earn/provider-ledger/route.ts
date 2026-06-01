import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, type Address } from "viem";
import {
  createPostgresBetIndexStore,
  type BankProviderLedgerRow,
  type BetIndexStore
} from "@ssot/bet-index";
import { createSSOTSDK } from "@ssot/ssot/sdk";
import type { BankProviderLedgerEntry } from "@ssot/ssot/sdk";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

import { parseRequestChainId } from "../../../../server/chain";
import { resolveServerRpcUrl } from "../../../../server/rpc";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../server/http/public-read-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
let durableBetIndexStore: BetIndexStore | null | undefined;
let durableBetIndexMigration: Promise<void> | null = null;

function createChain(chainId: number, rpcUrl: string) {
  return {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  } as const;
}

function clampLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function parsePoolId(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error("poolId must be a positive integer.");
  return parsed;
}

function parseOwner(value: string | null) {
  if (!value) throw new Error("owner is required.");
  try {
    return getAddress(value) as Address;
  } catch {
    throw new Error("owner must be a valid address.");
  }
}

function parseStartBlock(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error("startBlock must be a non-negative integer.");
  return parsed;
}

function parseOptionalNonNegativeInteger(value: string | null, label: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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

async function getReadyDurableBetIndexStore() {
  const store = getDurableBetIndexStore();
  if (!store) return null;
  durableBetIndexMigration ??= store.migrate();
  await durableBetIndexMigration;
  return store;
}

function toBankProviderLedgerRow({
  asset,
  bank,
  chainId,
  entry,
  owner,
  poolId
}: {
  asset: Address;
  bank: Address;
  chainId: number;
  entry: BankProviderLedgerEntry;
  owner: Address;
  poolId: number;
}): BankProviderLedgerRow {
  return {
    action: entry.action,
    asset,
    assets: entry.assets?.toString(),
    bank,
    blockNumber: entry.blockNumber,
    chainId,
    id: `${chainId}:bank-provider:${entry.txHash.toLowerCase()}:${entry.logIndex}`,
    logIndex: entry.logIndex,
    owner: owner.toLowerCase() as Address,
    poolId: String(poolId),
    sharePrice: entry.sharePrice?.toString(),
    shares: entry.shares.toString(),
    timestamp: entry.timestamp,
    txHash: entry.txHash.toLowerCase() as `0x${string}`,
    updatedAt: Date.now()
  };
}

function rowToJson(row: BankProviderLedgerRow) {
  return {
    id: row.id,
    action: row.action,
    txHash: row.txHash,
    blockNumber: row.blockNumber,
    logIndex: row.logIndex,
    timestamp: row.timestamp,
    assets: row.assets,
    sharePrice: row.sharePrice,
    shares: row.shares
  };
}

function pageFromRows(rows: BankProviderLedgerRow[], limit: number) {
  const visibleRows = rows.slice(0, limit);
  const lastRow = visibleRows.at(-1);
  return {
    rows: visibleRows,
    page: {
      limit,
      hasMore: rows.length > limit,
      nextCursor:
        rows.length > limit && lastRow
          ? {
              beforeBlock: lastRow.blockNumber,
              beforeLogIndex: lastRow.logIndex
            }
          : undefined
    }
  };
}

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders() });
}

export async function GET(request: Request) {
  const quota = publicReadRateLimit({
    envName: "EARN_PROVIDER_LEDGER_RATE_LIMIT_PER_MINUTE",
    fallback: 60,
    keyPrefix: "earn:provider-ledger",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson(
      "Too many provider-ledger requests. Please retry shortly.",
      quota.headers
    );
  }

  try {
    const url = new URL(request.url);
    const chainId = parseRequestChainId(url.searchParams.get("chainId"));
    const owner = parseOwner(url.searchParams.get("owner"));
    const poolId = parsePoolId(url.searchParams.get("poolId"));
    const limit = clampLimit(url.searchParams.get("limit"));
    const queryLimit = limit + 1;
    const startBlock = parseStartBlock(url.searchParams.get("startBlock"));
    const beforeBlock = parseOptionalNonNegativeInteger(
      url.searchParams.get("beforeBlock"),
      "beforeBlock"
    );
    const beforeLogIndex = parseOptionalNonNegativeInteger(
      url.searchParams.get("beforeLogIndex"),
      "beforeLogIndex"
    );
    if ((beforeBlock == null) !== (beforeLogIndex == null)) {
      throw new Error("beforeBlock and beforeLogIndex must be provided together.");
    }

    const releaseResult = loadEmbeddedRelease(chainId);
    if (!releaseResult.ok) throw new Error(releaseResult.error);
    const pool = releaseResult.release.pools.find((item) => item.poolId === poolId);
    if (!pool) throw new Error(`No pool found for poolId ${poolId}.`);
    const rpcUrl = resolveServerRpcUrl(chainId);
    if (!rpcUrl) throw new Error(`No RPC URL configured for chainId=${chainId}.`);

    const publicClient = createPublicClient({
      chain: createChain(chainId, rpcUrl),
      transport: http(rpcUrl)
    });
    const sdk = createSSOTSDK({ release: releaseResult.release, publicClient });
    let store: BetIndexStore | null = null;
    let durableRows: BankProviderLedgerRow[] = [];
    try {
      store = await getReadyDurableBetIndexStore();
      durableRows =
        store == null
          ? []
          : await store.getBankProviderLedger({
              beforeBlock,
              beforeLogIndex,
              chainId,
              limit: queryLimit,
              owner,
              poolId
            });
    } catch {
      store = null;
      durableRows = [];
    }

    // Normal product reads should be fast and durable: keeper/backfill owns
    // Postgres ingestion. RPC scanning remains only for explicit backfill/debug
    // requests (startBlock) or when no durable store is configured.
    const shouldScan = store == null || startBlock != null;
    const scannedEntries = shouldScan
      ? await sdk.bank.getProviderLedger(poolId, owner, { limit: queryLimit, startBlock })
      : [];
    const scannedRows = scannedEntries.map((entry) =>
      toBankProviderLedgerRow({
        asset: getAddress(pool.asset) as Address,
        bank: getAddress(pool.bank) as Address,
        chainId,
        entry,
        owner,
        poolId
      })
    );

    if (store) {
      const cachedRows = durableRows;
      try {
        if (scannedRows.length > 0) {
          await store.writeBankProviderLedgerRows(scannedRows);
        }
        durableRows = await store.getBankProviderLedger({
          beforeBlock,
          beforeLogIndex,
          chainId,
          limit: queryLimit,
          owner,
          poolId
        });
      } catch {
        store = null;
        durableRows = cachedRows;
      }
    }
    const rows = store ? durableRows : scannedRows.length > 0 ? scannedRows : durableRows;
    const page = pageFromRows(rows, limit);

    return NextResponse.json(
      {
        schemaVersion: 1,
        chainId,
        generatedAt: Date.now(),
        owner,
        poolId,
        source: store
          ? scannedRows.length > 0
            ? "postgres-backfill"
            : "postgres"
          : "server-rpc-window",
        page: page.page,
        rows: page.rows.map(rowToJson)
      },
      { headers: mergeHeaders(noStoreHeaders(), quota.headers) }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query provider ledger.";
    const status =
      message.includes("owner") ||
      message.includes("poolId") ||
      message.includes("startBlock") ||
      message.includes("beforeBlock") ||
      message.includes("beforeLogIndex")
        ? 400
        : 503;
    return jsonError(message, status, status === 400 ? "BAD_REQUEST" : "PROVIDER_LEDGER_FAILED");
  }
}
