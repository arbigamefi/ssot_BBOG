export function isMobileBrowser(win: Window) {
  return (
    /Android|iPhone|iPad|iPod/i.test(win.navigator.userAgent) ||
    (/Macintosh/i.test(win.navigator.userAgent) && win.navigator.maxTouchPoints > 0)
  );
}

export function isWalletBrowser(win: Window) {
  // Any injected provider already offers a connection path in the current tab.
  return (
    Boolean((win as Window & { ethereum?: unknown }).ethereum) ||
    /MetaMaskMobile|CoinbaseWallet|Trust\/|imToken|OKApp|TokenPocket/i.test(win.navigator.userAgent)
  );
}
