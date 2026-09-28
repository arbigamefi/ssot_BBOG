"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { SSOTSDK } from "@ssot/ssot/sdk";

type RecoveryCursor = NonNullable<Parameters<SSOTSDK["bank"]["getRecoveryPage"]>[2]>["cursor"];

export function useBankRecovery({
  sdk,
  poolId,
  blockNumber,
  enabled
}: {
  sdk?: SSOTSDK;
  poolId?: number;
  blockNumber?: bigint;
  enabled: boolean;
}) {
  const query = useInfiniteQuery({
    queryKey: [
      "ssot",
      "earn",
      "recovery",
      sdk?.release?.chainId,
      sdk?.release?.releaseDigest,
      poolId,
      sdk?.release?.pools.find((pool) => pool.poolId === poolId)?.bank.toLowerCase(),
      sdk?.account,
      blockNumber?.toString()
    ],
    enabled: Boolean(enabled && sdk?.account && poolId && blockNumber != null),
    initialPageParam: undefined as RecoveryCursor,
    queryFn: async ({ pageParam }) => {
      if (!sdk?.account || !poolId || blockNumber == null)
        throw new Error("Recovery snapshot unavailable.");
      const page = await sdk.bank.getRecoveryPage(poolId, sdk.account, {
        cursor: pageParam,
        limit: 25,
        blockNumber
      });
      if (page.updatedAtBlock !== blockNumber || (!page.complete && page.nextCursor == null)) {
        throw new Error("Incomplete or inconsistent recovery page.");
      }
      return page;
    },
    getNextPageParam: (lastPage) => (lastPage.complete ? undefined : lastPage.nextCursor),
    staleTime: Infinity
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const complete = !query.error && query.data?.pages.at(-1)?.complete === true;
  return {
    ...query,
    items,
    complete,
    hasUnsettledRecovery: items.some((item) => item.remainingHolds > 0n),
    claimableAssets: items.reduce((sum, item) => sum + item.claimableAssets, 0n)
  };
}
