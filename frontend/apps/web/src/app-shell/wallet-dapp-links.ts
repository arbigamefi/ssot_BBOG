export type WalletDappHandoff = { name: string; href: string; downloadHref: string };

export function openWalletDapp(href: string) {
  try {
    window.location.assign(href);
  } catch {
    /* The selector retains retry/download links. */
  }
}

// DApp-browser routes, not WalletConnect pairing routes. See mobile-wallet-entry.md.
export function getWalletDappHandoff(
  walletId: string,
  currentHref: string,
  chainId: number,
  ios: boolean
): WalletDappHandoff | undefined {
  const url = new URL(currentHref);
  if (url.protocol !== "https:" || url.username || url.password) return;
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return;
  url.searchParams.set("chainId", String(chainId));
  const target = url.toString();
  const encoded = encodeURIComponent(target);
  switch (walletId) {
    case "metaMask":
      return {
        name: "MetaMask",
        href: `metamask://dapp/${target.slice("https://".length)}`,
        downloadHref: ios
          ? "https://apps.apple.com/app/metamask/id1438144202"
          : "https://play.google.com/store/apps/details?id=io.metamask"
      };
    case "trust":
      // coin_id is SLIP-44 (Ethereum), not the EVM chain ID. Our URL preserves
      // the selected network; account connection handles wallet chain switching.
      return {
        name: "Trust Wallet",
        href: `trust://open_url?coin_id=60&url=${encoded}`,
        downloadHref: ios
          ? "https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409"
          : "https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp"
      };
    case "rainbow":
      return {
        name: "Rainbow",
        href: `rainbow://dapp?url=${encoded}`,
        downloadHref: ios
          ? "https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119021"
          : "https://play.google.com/store/apps/details?id=me.rainbow"
      };
    case "okx":
      return {
        name: "OKX Wallet",
        href: `okx://wallet/dapp/url?dappUrl=${encoded}`,
        downloadHref: ios
          ? "https://apps.apple.com/app/id1327268470"
          : "https://play.google.com/store/apps/details?id=com.okinc.okex.gp"
      };
    case "coinbase":
      // Official Coinbase MobileRelay DApp-browser route. Its app owns the
      // universal-link routing; unlike the other wallets we do not invent a scheme.
      return {
        name: "Coinbase Wallet",
        href: `https://go.cb-w.com/dapp?cb_url=${encoded}`,
        downloadHref: "https://www.coinbase.com/wallet/downloads"
      };
    default:
      // WalletConnect and unknown/EIP-6963 wallets keep their official flows.
      return;
  }
}
