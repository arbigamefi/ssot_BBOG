export const WALLET_OPTIONS = [
  { id: "metamask", name: "MetaMask" },
  { id: "trust", name: "Trust Wallet" }
] as const;

export function isMobileBrowser(win: Window) {
  return (
    /Android|iPhone|iPad|iPod/i.test(win.navigator.userAgent) || win.navigator.maxTouchPoints > 0
  );
}

export function isWalletBrowser(win: Window) {
  // Any injected provider already offers a connection path in the current tab.
  return (
    Boolean((win as Window & { ethereum?: unknown }).ethereum) ||
    /MetaMaskMobile|CoinbaseWallet|Trust\/|imToken|OKApp|TokenPocket/i.test(win.navigator.userAgent)
  );
}

export function walletDestination(currentUrl: string, chainId: number) {
  const current = new URL(currentUrl);
  const target = new URL(current.pathname, current.origin);
  // Browser storage does not cross into a wallet's browser. Carry only public
  // navigation context; never copy arbitrary query strings or fragments.
  target.searchParams.set("chainId", String(chainId));
  const referral = current.searchParams.get("ref");
  if (referral && /^0x[a-fA-F0-9]{40}$/.test(referral)) target.searchParams.set("ref", referral);
  return target.href;
}

export function walletDeepLink(wallet: string, destination: string) {
  const url = new URL(destination);
  if (wallet === "metamask")
    return `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}`;
  return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(destination)}`;
}
