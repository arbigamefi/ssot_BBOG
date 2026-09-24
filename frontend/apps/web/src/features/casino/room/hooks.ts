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
  riskInPaused?: boolean;
  riskReserveBps?: number;
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
export type PoolAvailability = "loading" | "unavailable" | "paused" | "ready";

export function usePoolSnapshot({
  sdk,
  poolId,
  refreshMs = 20_000
}: {
  sdk: SnapshotSdk | null | undefined;
  poolId: number | undefined;
  refreshMs?: number;
}) {
  const bank = sdk?.bank;
  const [revision, refresh] = React.useReducer((value: number) => value + 1, 0);
  const [readState, setReadState] = React.useState<{
    bank: SnapshotSdk["bank"];
    poolId?: number;
    revision: number;
    snapshot: PoolSnapshot | null;
    status: PoolAvailability;
  }>();

  React.useEffect(() => {
    if (!bank || poolId == null) return;
    let cancelled = false;
    let reading = false;
    const read = async () => {
      if (reading) return;
      reading = true;
      try {
        const snapshot = await bank.getSnapshot(poolId);
        if (!cancelled)
          setReadState({
            bank,
            poolId,
            revision,
            snapshot,
            status:
              typeof snapshot.riskInPaused !== "boolean"
                ? "unavailable"
                : snapshot.riskInPaused
                  ? "paused"
                  : "ready"
          });
      } catch {
        if (!cancelled)
          setReadState({ bank, poolId, revision, snapshot: null, status: "unavailable" });
      } finally {
        reading = false;
      }
    };
    void read();
    const interval = setInterval(read, Math.max(1_000, refreshMs));
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bank, poolId, refreshMs, revision]);

  // Never reuse the previous chain/pool's ready state during a React render.
  const current =
    readState?.bank === bank && readState?.poolId === poolId && readState?.revision === revision
      ? readState
      : undefined;
  return {
    snapshot: current?.snapshot ?? null,
    status: current?.status ?? ("loading" as PoolAvailability),
    refresh
  };
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
