import * as React from "react";
import type { PoolAssetContext } from "../../assets/pool-asset";
import { formatAssetAmount } from "../../assets/pool-asset";

type BalanceSdk = {
  account?: `0x${string}`;
  bank?: {
    getAssetBalance: (asset: `0x${string}`, account: `0x${string}`) => Promise<bigint>;
  };
};

export type GameWalletBalance = {
  label: string;
  raw: bigint;
};

export function formatTokenBalance(raw: bigint, decimals: number, symbol: string) {
  return formatAssetAmount(raw, { decimals, symbol }, { fractionDigits: 2 });
}

export function pickKenoStrobeSpots(count = 5) {
  const spots: number[] = [];
  while (spots.length < count) {
    const num = Math.floor(Math.random() * 15) + 1;
    if (!spots.includes(num)) spots.push(num);
  }
  return spots;
}

export function useGameWalletBalance({
  sdk,
  asset,
  refreshKey,
  refreshMs = 10_000
}: {
  sdk: BalanceSdk | null | undefined;
  asset: PoolAssetContext["asset"] | null | undefined;
  refreshKey?: unknown;
  refreshMs?: number;
}): GameWalletBalance | null {
  const [walletBalance, setWalletBalance] = React.useState<GameWalletBalance | null>(null);

  React.useEffect(() => {
    const account = sdk?.account;
    const bank = sdk?.bank;
    const assetAddress = asset?.address as `0x${string}` | undefined;
    const assetDecimals = asset?.decimals;
    const assetSymbol = asset?.symbol;

    if (!account || !asset || assetDecimals == null || !assetSymbol) {
      setWalletBalance(null);
      return;
    }
    if (!assetAddress || !bank) {
      setWalletBalance(null);
      return;
    }

    let cancelled = false;
    const read = () => {
      bank
        .getAssetBalance(assetAddress, account)
        .then((raw) => {
          if (!cancelled) {
            setWalletBalance({
              label: formatTokenBalance(raw, assetDecimals, assetSymbol),
              raw
            });
          }
        })
        .catch(() => {
          if (!cancelled) setWalletBalance(null);
        });
    };

    read();
    const interval =
      refreshMs > 0 ? window.setInterval(read, Math.max(1_000, refreshMs)) : undefined;
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [
    sdk?.account,
    sdk?.bank,
    asset?.address,
    asset?.decimals,
    asset?.symbol,
    refreshKey,
    refreshMs
  ]);

  return walletBalance;
}

/** Minimal pool-snapshot shape used for header liquidity-derived limits. */
export type PoolSnapshot = {
  totalAssets: bigint;
  totalReserved: bigint;
  minLiquidityBps?: number;
};

type SnapshotSdk = {
  bank?: { getSnapshot: (poolId: number) => Promise<PoolSnapshot> };
};

/**
 * Public read of a pool's bank snapshot (no wallet required), refreshed gently
 * so the header's live max-bet / max-payout stay roughly current. Mirrors the
 * effect-based pattern of useGameWalletBalance (no React Query dependency).
 */
export function usePoolSnapshot({
  sdk,
  poolId,
  refreshMs = 20_000
}: {
  sdk: SnapshotSdk | null | undefined;
  poolId: number | undefined;
  refreshMs?: number;
}): PoolSnapshot | null {
  const [snapshot, setSnapshot] = React.useState<PoolSnapshot | null>(null);

  React.useEffect(() => {
    if (!sdk?.bank || poolId == null) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    const read = () => {
      sdk
        .bank!.getSnapshot(poolId)
        .then((snap) => {
          if (!cancelled) setSnapshot(snap);
        })
        .catch(() => {
          if (!cancelled) setSnapshot(null);
        });
    };
    read();
    const interval = setInterval(read, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sdk?.bank, poolId, refreshMs]);

  return snapshot;
}

export function useKenoStrobeSpots({
  isPending,
  gameSlug
}: {
  isPending: boolean;
  gameSlug: string | undefined;
}) {
  const [spots, setSpots] = React.useState<number[]>([]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (isPending && gameSlug === "keno") {
      interval = setInterval(() => {
        setSpots(pickKenoStrobeSpots());
      }, 80);
    } else {
      setSpots([]);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPending, gameSlug]);

  return spots;
}
