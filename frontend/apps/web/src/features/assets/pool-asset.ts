import type { Address } from "@ssot/ssot/sdk";

import { formatUnits } from "../betting/model/units";

export type ReleaseAssetLike = {
  address?: string;
  decimals?: number;
  symbol?: string;
};

export type ReleasePoolLike = {
  asset?: string;
  bank?: string;
  vault?: string;
  decimals?: number;
  domain?: string;
  domainId?: number;
  poolId: number;
  symbol?: string;
};

export type PoolAssetReleaseLike = {
  assets?: readonly ReleaseAssetLike[];
  pools?: readonly ReleasePoolLike[];
};

export type PoolAssetContext = {
  asset: {
    address: Address;
    decimals: number;
    symbol: string;
  };
  bank?: Address;
  pool: ReleasePoolLike;
  poolId: number;
};

function normalizeAddress(value?: string | null) {
  return value?.toLowerCase();
}

export function getPoolAssetContext(
  release: PoolAssetReleaseLike,
  pool: ReleasePoolLike | undefined
): PoolAssetContext | null {
  if (!pool?.asset) return null;
  const assetAddress = normalizeAddress(pool.asset);
  const assetMeta = (release.assets ?? []).find(
    (asset) => normalizeAddress(asset.address) === assetAddress
  );
  const symbol = pool.symbol ?? assetMeta?.symbol;
  const decimals = pool.decimals ?? assetMeta?.decimals;
  if (!assetAddress || !symbol || decimals == null) return null;

  return {
    asset: {
      address: assetAddress as Address,
      decimals,
      symbol
    },
    bank: pool.bank ? (normalizeAddress(pool.bank) as Address) : undefined,
    pool,
    poolId: pool.poolId
  };
}

/** Every release pool; whether one takes bets is read live (the bank snapshot's poolActive). */
export function getCasinoPoolAssetContexts(release: PoolAssetReleaseLike) {
  return (release.pools ?? [])
    .map((pool) => getPoolAssetContext(release, pool))
    .filter((item): item is PoolAssetContext => Boolean(item));
}

export function getDefaultCasinoPoolAssetContext(release: PoolAssetReleaseLike) {
  return getCasinoPoolAssetContexts(release)[0] ?? null;
}

export function formatAssetAmount(
  value: bigint | undefined | null,
  asset: Pick<PoolAssetContext["asset"], "decimals" | "symbol">,
  options: {
    fractionDigits?: number;
    locale?: string;
    pendingLabel?: string;
  } = {}
) {
  if (value == null) return options.pendingLabel ?? "—";
  const locale = options.locale ?? "en-US";
  const fractionDigits = options.fractionDigits ?? 2;
  const raw = formatUnits(value, asset.decimals);
  const [intPart = "0", fracPart = ""] = raw.split(".");
  const cleanedFrac = fracPart.slice(0, fractionDigits).replace(/0+$/, "");
  const amount = `${BigInt(intPart || "0").toLocaleString(locale)}${
    cleanedFrac ? `.${cleanedFrac}` : ""
  }`;
  return `${amount} ${asset.symbol}`;
}
