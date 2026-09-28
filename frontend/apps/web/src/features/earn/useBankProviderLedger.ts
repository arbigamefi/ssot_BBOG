"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Address, SSOTSDK } from "@ssot/ssot/sdk";

import type { EarnProviderLedgerEntry } from "./types";

const LEDGER_PAGE_SIZE = 25;

type ProviderLedgerApiRow = Omit<
  EarnProviderLedgerEntry,
  "assets" | "sharePrice" | "shares" | "epochId"
> & {
  assets?: string;
  sharePrice?: string;
  shares: string;
  epochId?: string;
};

type ProviderLedgerApiResponse = {
  rows: ProviderLedgerApiRow[];
  coverage?: { fromBlock: number | null; toBlock: number; complete: boolean };
  page?: {
    limit: number;
    hasMore: boolean;
    nextCursor?: ProviderLedgerCursor;
  };
};

type ProviderLedgerCursor = {
  beforeBlock: number;
  beforeLogIndex: number;
};

type UseBankProviderLedgerInput = {
  poolId?: number;
  enabled?: boolean;
  sdk?: SSOTSDK;
  startBlock?: number;
  endBlock?: bigint;
};

function parseOptionalBigInt(value?: string) {
  return value == null ? undefined : BigInt(value);
}

function rowFromApi(row: ProviderLedgerApiRow): EarnProviderLedgerEntry {
  return {
    ...row,
    assets: parseOptionalBigInt(row.assets),
    sharePrice: parseOptionalBigInt(row.sharePrice),
    epochId: parseOptionalBigInt(row.epochId),
    shares: BigInt(row.shares)
  };
}

export function useBankProviderLedger({
  enabled = true,
  poolId,
  sdk,
  startBlock,
  endBlock
}: UseBankProviderLedgerInput) {
  const query = useInfiniteQuery({
    queryKey: [
      "ssot",
      "earn",
      "providerLedger",
      sdk?.release?.chainId,
      sdk?.release?.releaseDigest,
      sdk?.release?.pools.find((pool) => pool.poolId === poolId)?.bank.toLowerCase(),
      poolId,
      sdk?.account,
      startBlock,
      endBlock?.toString()
    ],
    initialPageParam: undefined as ProviderLedgerCursor | undefined,
    enabled: Boolean(enabled && sdk?.account && poolId && endBlock != null),
    queryFn: async ({ pageParam }): Promise<ProviderLedgerApiResponse> => {
      if (!sdk?.account || !poolId) return { rows: [] };
      const params = new URLSearchParams({
        chainId: String(sdk.release.chainId),
        limit: String(LEDGER_PAGE_SIZE),
        owner: sdk.account as Address,
        poolId: String(poolId)
      });
      const bank = sdk.release.pools.find((pool) => pool.poolId === poolId)?.bank;
      if (bank) params.set("bank", bank);
      if (startBlock != null) params.set("startBlock", String(startBlock));
      if (endBlock != null) params.set("endBlock", endBlock.toString());
      if (pageParam) {
        params.set("beforeBlock", String(pageParam.beforeBlock));
        params.set("beforeLogIndex", String(pageParam.beforeLogIndex));
      }
      const response = await fetch(`/api/earn/provider-ledger?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Failed to load provider ledger.");
      }
      return (await response.json()) as ProviderLedgerApiResponse;
    },
    getNextPageParam: (lastPage) => (lastPage.page?.hasMore ? lastPage.page.nextCursor : undefined),
    staleTime: Infinity
  });

  const entries = React.useMemo(
    () =>
      query.data?.pages.flatMap((page) =>
        page.rows
          .filter((row) => endBlock != null && BigInt(row.blockNumber) <= endBlock)
          .map(rowFromApi)
      ) ?? [],
    [query.data, endBlock]
  );

  return {
    ...query,
    entries,
    coverageComplete:
      !query.error &&
      query.data?.pages.at(-1)?.coverage?.complete === true &&
      query.data.pages.every((page) => page.coverage?.toBlock === Number(endBlock)) &&
      query.hasNextPage === false
  };
}
