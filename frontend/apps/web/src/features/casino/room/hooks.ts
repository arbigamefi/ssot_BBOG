import * as React from "react";

type BalanceAsset = {
  symbol?: string;
  address?: string;
  decimals?: number;
};

type BalanceSdk = {
  account?: `0x${string}`;
  bank?: {
    getAssetBalance: (asset: `0x${string}`, account: `0x${string}`) => Promise<bigint>;
  };
};

export function formatTokenBalance(raw: bigint, decimals: number) {
  return `${(Number(raw) / Math.pow(10, decimals)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} USDC`;
}

export function pickKenoStrobeSpots(count = 8) {
  const spots: number[] = [];
  while (spots.length < count) {
    const num = Math.floor(Math.random() * 40) + 1;
    if (!spots.includes(num)) spots.push(num);
  }
  return spots;
}

export function useGameWalletBalance({
  sdk,
  assets
}: {
  sdk: BalanceSdk | null | undefined;
  assets: readonly BalanceAsset[] | undefined;
}) {
  const [walletBalance, setWalletBalance] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sdk?.account || !assets) return;
    const usdcAsset = assets.find((asset) => asset.symbol === "USDC");
    if (!usdcAsset?.address || !sdk.bank) return;

    sdk.bank
      .getAssetBalance(usdcAsset.address as `0x${string}`, sdk.account)
      .then((raw) => {
        setWalletBalance(formatTokenBalance(raw, usdcAsset.decimals ?? 6));
      })
      .catch(() => setWalletBalance(null));
  }, [sdk?.account, sdk?.bank, assets]);

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
