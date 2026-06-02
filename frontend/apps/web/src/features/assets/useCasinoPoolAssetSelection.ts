"use client";

import * as React from "react";
import type { AssetOption } from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import {
  getCasinoPoolAssetContexts,
  getDefaultCasinoPoolAssetContext,
  type PoolAssetContext
} from "./pool-asset";

/** Per-chain persisted choice so switching chains restores that chain's asset. */
const STORAGE_PREFIX = "arbigamefi.casinoAsset.v1";

export type CasinoPoolAssetSelection = {
  /** All active casino pool assets on the current chain, as selector options. */
  assetOptions: AssetOption[];
  /** Currently selected asset address; undefined when the chain has no casino pool. */
  selectedAsset?: `0x${string}`;
  setSelectedAsset: (address: `0x${string}`) => void;
  /** Full context for the selected asset (pool, bank, decimals, symbol). */
  selectedContext: PoolAssetContext | null;
  /** Pool id for the selected asset — required for deposits/bets. */
  poolId?: number;
  decimals?: number;
  symbol?: string;
  /** True when the selected asset maps to an active pool (writes/bets allowed). */
  writesSupported: boolean;
  /** The full list of casino pool contexts (for callers needing more than options). */
  contexts: PoolAssetContext[];
};

function isSupported(options: AssetOption[], address?: string | null) {
  if (!address) return false;
  const lower = address.toLowerCase();
  return options.some((option) => option.address.toLowerCase() === lower);
}

/**
 * Single source of truth for "which casino pool asset is the user acting on".
 *
 * Lists every active casino pool asset on the current chain, tracks the
 * selection (persisted per chain), and resolves it to a pool id + decimals +
 * symbol. Shared by the earn console and the casino room so both present the
 * same set of assets and write to the same pool. Reads the release from
 * `ReleaseProvider`, so it follows chain switches automatically.
 */
export function useCasinoPoolAssetSelection(): CasinoPoolAssetSelection {
  const { release, chainId } = useRelease();

  const contexts = React.useMemo(
    () => (release ? getCasinoPoolAssetContexts(release) : []),
    [release]
  );
  const defaultContext = React.useMemo(
    () => (release ? getDefaultCasinoPoolAssetContext(release) : null),
    [release]
  );
  const assetOptions = React.useMemo<AssetOption[]>(
    () =>
      contexts.map(({ asset }) => ({
        address: asset.address,
        symbol: asset.symbol,
        decimals: asset.decimals,
        label: `${asset.symbol} (${asset.decimals})`
      })),
    [contexts]
  );

  const [selectedAsset, setSelectedAssetState] = React.useState<`0x${string}` | undefined>(
    () => defaultContext?.asset.address
  );

  // Keep the selection valid for the current chain. Starting from the default
  // (deterministic for SSR/hydration), this effect restores a stored, still
  // supported per-chain choice on mount and re-coerces when the option set
  // changes (a chain switch), falling back to the default pool.
  React.useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(`${STORAGE_PREFIX}:${chainId}`)
        : null;
    if (isSupported(assetOptions, stored) && stored !== selectedAsset) {
      setSelectedAssetState(stored as `0x${string}`);
      return;
    }
    if (isSupported(assetOptions, selectedAsset)) return;
    const fallback = defaultContext?.asset.address;
    if (fallback && fallback !== selectedAsset) setSelectedAssetState(fallback);
  }, [assetOptions, chainId, defaultContext, selectedAsset]);

  const setSelectedAsset = React.useCallback(
    (address: `0x${string}`) => {
      if (!isSupported(assetOptions, address)) return;
      setSelectedAssetState(address);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`${STORAGE_PREFIX}:${chainId}`, address);
      }
    },
    [assetOptions, chainId]
  );

  const selectedContext = React.useMemo(() => {
    const lower = (selectedAsset ?? "").toLowerCase();
    return contexts.find((context) => context.asset.address.toLowerCase() === lower) ?? null;
  }, [contexts, selectedAsset]);

  return {
    assetOptions,
    selectedAsset,
    setSelectedAsset,
    selectedContext,
    poolId: selectedContext?.poolId,
    decimals: selectedContext?.asset.decimals,
    symbol: selectedContext?.asset.symbol,
    writesSupported: Boolean(selectedContext?.poolId),
    contexts
  };
}
