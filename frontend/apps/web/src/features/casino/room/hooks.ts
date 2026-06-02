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
  asset
}: {
  sdk: BalanceSdk | null | undefined;
  asset: PoolAssetContext["asset"] | null | undefined;
}): GameWalletBalance | null {
  const [walletBalance, setWalletBalance] = React.useState<GameWalletBalance | null>(null);

  React.useEffect(() => {
    if (!sdk?.account || !asset) {
      setWalletBalance(null);
      return;
    }
    if (!asset.address || !sdk.bank) {
      setWalletBalance(null);
      return;
    }

    sdk.bank
      .getAssetBalance(asset.address as `0x${string}`, sdk.account)
      .then((raw) => {
        setWalletBalance({
          label: formatTokenBalance(raw, asset.decimals, asset.symbol),
          raw
        });
      })
      .catch(() => setWalletBalance(null));
  }, [sdk?.account, sdk?.bank, asset]);

  return walletBalance;
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
