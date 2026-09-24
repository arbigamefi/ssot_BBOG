import type { WalletList } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rainbowWallet,
  trustWallet
} from "@rainbow-me/rainbowkit/wallets";

// The SDK's default metamask:// link has no destination when the app is
// absent. Its official HTTPS universal link provides an installation path.
metaMaskWallet.useDeeplink = false;
type WalletFactory = WalletList[number]["wallets"][number];

export const metaMaskWalletWithFallback: WalletFactory = (options) => ({
  ...metaMaskWallet(options),
  // SDK 0.33 opens the mobile link itself after emitting display_uri. Let it
  // own navigation; RainbowKit otherwise opens the same pairing a second time.
  mobile: undefined
});

export const browserWalletWhenAvailable: WalletFactory = () => ({
  ...injectedWallet(),
  hidden: () => typeof window === "undefined" || !("ethereum" in window && window.ethereum)
});

// Keep RainbowKit's injected providers, pairing and download UI. Only replace
// app-only schemes with each wallet's HTTPS handoff, never the generic WC row.
function withUniversalLink(factory: WalletFactory, getUri: (uri: string) => string): WalletFactory {
  return (options) => {
    const wallet = factory(options);
    return wallet.mobile?.getUri ? { ...wallet, mobile: { ...wallet.mobile, getUri } } : wallet;
  };
}

export const trustWalletWithFallback = withUniversalLink(
  trustWallet,
  (uri) => `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`
);
export const rainbowWalletWithFallback = withUniversalLink(
  rainbowWallet,
  (uri) => `https://rnbwapp.com/wc?uri=${encodeURIComponent(uri)}&connector=rainbowkit`
);
export const okxWalletWithFallback = withUniversalLink(
  okxWallet,
  (uri) =>
    `https://www.okx.com/download?deeplink=${encodeURIComponent(`okex://main/wc?uri=${encodeURIComponent(uri)}`)}`
);
