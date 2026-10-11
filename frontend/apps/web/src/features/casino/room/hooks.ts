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
  L: bigint;
  G: bigint;
  R: bigint;
  minBetAmount: bigint;
  openHolds: bigint;
  maxOpenHolds: bigint;
  accountingValid: boolean;
  riskInPaused: boolean;
  /** PoolRegistry activity: an inactive pool takes no new bets (not started, or stopped). */
  poolActive: boolean;
  riskReserveBps: number;
};

type SnapshotSdk = {
  bank?: { getSnapshot: (poolId: number) => Promise<PoolSnapshot> };
};

type OpenHoldsSdk = {
  bank?: {
    getOpenHolds: (poolId: number, player: `0x${string}`) => Promise<{ open: bigint; max: bigint }>;
  };
};

/**
 * Public read of a pool's bank snapshot (no wallet required), refreshed gently
 * so the header's live max-bet / max-payout stay roughly current. Mirrors the
 * effect-based pattern of useGameWalletBalance (no React Query dependency).
 */
export type PoolAvailability =
  | "loading"
  | "unavailable"
  | "paused"
  | "inactive"
  | "ready"
  | "full"
  | "playerLimit"
  | "noLiquidity"
  | "invalidAccounting"
  | "gameUnavailable"
  | "invalidCount";

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
            status: !snapshot.accountingValid
              ? "invalidAccounting"
              : snapshot.riskInPaused
                ? "paused"
                : !snapshot.poolActive
                  ? "inactive"
                  : snapshot.openHolds >= snapshot.maxOpenHolds
                    ? "full"
                    : snapshot.L <= 0n
                      ? "noLiquidity"
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

/**
 * The connected player's open bets in one pool's Bank and the per-player cap (ADR-0037 §5: two).
 * A failed read reports no limit: planPlaceBet checks the cap again before any wallet prompt.
 */
export function usePlayerOpenHolds({
  sdk,
  poolId,
  account,
  refreshMs = 20_000
}: {
  sdk: OpenHoldsSdk | null | undefined;
  poolId: number | undefined;
  account: `0x${string}` | undefined;
  refreshMs?: number;
}) {
  const bank = sdk?.bank;
  const [revision, refresh] = React.useReducer((value: number) => value + 1, 0);
  const [readState, setReadState] = React.useState<{
    bank: OpenHoldsSdk["bank"];
    poolId?: number;
    account?: string;
    holds: { open: bigint; max: bigint } | null;
  }>();

  React.useEffect(() => {
    if (!bank || poolId == null || !account) return;
    let cancelled = false;
    let reading = false;
    const read = async () => {
      if (reading) return;
      reading = true;
      try {
        const holds = await bank.getOpenHolds(poolId, account);
        if (!cancelled) setReadState({ bank, poolId, account, holds });
      } catch {
        if (!cancelled) setReadState({ bank, poolId, account, holds: null });
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
  }, [account, bank, poolId, refreshMs, revision]);

  // Never show another wallet's or pool's count.
  const holds =
    readState &&
    readState.bank === bank &&
    readState.poolId === poolId &&
    readState.account === account
      ? readState.holds
      : null;
  return {
    holds,
    atLimit: holds != null && holds.open >= holds.max,
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
