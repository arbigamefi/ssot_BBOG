"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Address, SSOTSDK } from "@ssot/ssot/sdk";

import type { EarnProviderLedgerEntry } from "./types";

const LEDGER_PAGE_SIZE = 25;

type ProviderLedgerApiRow = Omit<EarnProviderLedgerEntry, "assets" | "sharePrice" | "shares"> & {
  assets?: string;
  sharePrice?: string;
  shares: string;
};

type ProviderLedgerApiResponse = {
  rows: ProviderLedgerApiRow[];
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
};

function parseOptionalBigInt(value?: string) {
  return value == null ? undefined : BigInt(value);
}

function rowFromApi(row: ProviderLedgerApiRow): EarnProviderLedgerEntry {
  return {
    ...row,
    assets: parseOptionalBigInt(row.assets),
    sharePrice: parseOptionalBigInt(row.sharePrice),
    shares: BigInt(row.shares)
  };
}

export function useBankProviderLedger({
  enabled = true,
  poolId,
  sdk,
  startBlock
}: UseBankProviderLedgerInput) {
  const query = useInfiniteQuery({
    queryKey: [
      "ssot",
      "earn",
      "providerLedger",
      sdk?.release?.chainId,
      poolId,
      sdk?.account,
      startBlock
    ],
    initialPageParam: undefined as ProviderLedgerCursor | undefined,
    enabled: Boolean(enabled && sdk?.account && poolId),
    queryFn: async ({ pageParam }): Promise<ProviderLedgerApiResponse> => {
      if (!sdk?.account || !poolId) return { rows: [] };
      const params = new URLSearchParams({
        chainId: String(sdk.release.chainId),
        limit: String(LEDGER_PAGE_SIZE),
        owner: sdk.account as Address,
        poolId: String(poolId)
      });
      if (startBlock != null) params.set("startBlock", String(startBlock));
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
    refetchInterval: 30_000,
    staleTime: 20_000
  });

  const entries = React.useMemo(
    () => query.data?.pages.flatMap((page) => page.rows.map(rowFromApi)) ?? [],
    [query.data]
  );

  return {
    ...query,
    entries
  };
}
