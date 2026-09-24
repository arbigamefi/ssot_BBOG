import type { WalletList } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";

type WalletFactory = WalletList[number]["wallets"][number];

export const browserWalletWhenAvailable: WalletFactory = () => ({
  ...injectedWallet(),
  hidden: () => typeof window === "undefined" || !("ethereum" in window && window.ethereum)
});
