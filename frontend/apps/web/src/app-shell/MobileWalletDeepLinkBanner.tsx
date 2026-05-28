"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowTopRightOnSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

const DISMISS_STORAGE_KEY = "arbigamefi.mobileDeepLink.dismissedV1";

/**
 * Helps mobile-browser users get into a wallet's in-app browser, where
 * `window.ethereum` is auto-injected and the connection flow is one-tap.
 *
 * The detection layers are intentional:
 *   1. Don't render on desktop — desktop has browser extensions.
 *   2. Don't render if we're already inside a wallet's WebView
 *      (`window.ethereum` exists, or known UA fingerprints match).
 *      Showing "open in wallet" to someone already inside a wallet is
 *      confusing and breaks trust.
 *   3. Don't render if the user dismissed it this session.
 */
export function MobileWalletDeepLinkBanner() {
  const t = useTranslations("app");
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === "1";
    if (dismissed) return;
    if (!isMobileUA(window.navigator.userAgent)) return;
    if (isInsideWalletBrowser(window)) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "https://arbigamefi.app";
  const host = (() => {
    try {
      return new URL(currentUrl).host;
    } catch {
      return "arbigamefi.app";
    }
  })();

  // Universal deep links — these all open the dapp inside the wallet's
  // in-app browser when the app is installed, and fall through to the app
  // store / web fallback when it isn't.
  const links: Array<{ id: string; label: string; href: string }> = [
    {
      id: "metamask",
      label: t("mobileDeepLink.openIn.metamask"),
      href: `https://metamask.app.link/dapp/${host}${normalizePath(currentUrl)}`
    },
    {
      id: "coinbase",
      label: t("mobileDeepLink.openIn.coinbase"),
      href: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`
    },
    {
      id: "trust",
      label: t("mobileDeepLink.openIn.trust"),
      href: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`
    }
  ];

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_STORAGE_KEY, "1");
    }
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label={t("mobileDeepLink.title")}
      className="sticky top-0 z-40 border-b border-border-soft bg-surface-2 px-4 py-3 lg:hidden"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-fg">{t("mobileDeepLink.title")}</p>
            <p className="mt-0.5 text-[11px] leading-4 text-fg-muted">
              {t("mobileDeepLink.description")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("mobileDeepLink.dismiss")}
            onClick={dismiss}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-soft text-fg-muted hover:text-fg"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-hide flex gap-2 overflow-x-auto">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-soft bg-surface-1 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fg transition-colors hover:border-brand/40 hover:text-brand"
              )}
            >
              {link.label}
              <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Heuristic UA-based mobile detection — good enough for the banner gate. */
function isMobileUA(ua: string): boolean {
  if (!ua) return false;
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

/**
 * Detect whether the page is already running inside a known wallet's
 * in-app WebView. We check the EIP-1193 provider's identity flags *and*
 * the user-agent string — the UA is the more reliable signal because the
 * provider can be missing during the brief moment before injection.
 */
function isInsideWalletBrowser(win: Window): boolean {
  const eth = (
    win as unknown as {
      ethereum?: {
        isMetaMask?: boolean;
        isCoinbaseWallet?: boolean;
        isTrust?: boolean;
        isTrustWallet?: boolean;
      };
    }
  ).ethereum;
  if (eth && (eth.isMetaMask || eth.isCoinbaseWallet || eth.isTrust || eth.isTrustWallet)) {
    return true;
  }
  const ua = win.navigator.userAgent;
  if (/MetaMaskMobile|CoinbaseWallet|Trust\/|imToken|OKApp|TokenPocket/i.test(ua)) {
    return true;
  }
  return false;
}

function normalizePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}
