"use client";

import * as React from "react";
import { WalletEntryContext } from "./wallet-entry-context";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { WalletIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useActiveChain } from "./ActiveChainProvider";
import { useCompliance } from "./compliance";
import { isCasinoRiskInEnabledForChain } from "./casino-access";
import { WALLET_CONNECT_REQUEST_EVENT } from "./wallet-connect-events";
import { isMobileBrowser, isWalletBrowser } from "./mobile-wallet-browser";

const DISMISS_KEY = "arbigamefi.mobileDeepLink.dismissedV1";

function readSession(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* Optional preference. */
  }
}

export function MobileWalletEntryProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("app.mobileWallet");
  const pathname = usePathname();
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { selectedChainId } = useActiveChain();
  const { hydrated, entryCleared, cookieConsent, rgDialogOpen } = useCompliance();
  const [eligibleBrowser, setEligibleBrowser] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [otherOverlay, setOtherOverlay] = React.useState(false);
  const eligible = eligibleBrowser && !isConnected && !isConnecting && !isReconnecting;
  const mainnetUnavailable = !isCasinoRiskInEnabledForChain(selectedChainId);

  React.useEffect(() => {
    let announced = false;
    const narrow = window.matchMedia("(max-width: 767px)");
    const refresh = () =>
      setEligibleBrowser(
        narrow.matches && !announced && isMobileBrowser(window) && !isWalletBrowser(window)
      );
    const providerAnnounced = () => {
      announced = true;
      setEligibleBrowser(false);
    };
    refresh();
    setDismissed(readSession(DISMISS_KEY) === "1");
    narrow.addEventListener("change", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("ethereum#initialized", refresh);
    window.addEventListener("eip6963:announceProvider", providerAnnounced);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      narrow.removeEventListener("change", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("ethereum#initialized", refresh);
      window.removeEventListener("eip6963:announceProvider", providerAnnounced);
    };
  }, []);

  React.useEffect(() => {
    if (pathname !== "/casino") return;
    const refresh = () =>
      setOtherOverlay(
        Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')) ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "")
      );
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-modal", "role"]
    });
    document.addEventListener("focusin", refresh);
    document.addEventListener("focusout", refresh);
    refresh();
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", refresh);
      document.removeEventListener("focusout", refresh);
    };
  }, [pathname]);

  const connect = React.useCallback(() => {
    openConnectModal?.();
  }, [openConnectModal]);

  React.useEffect(() => {
    window.addEventListener(WALLET_CONNECT_REQUEST_EVENT, connect);
    return () => window.removeEventListener(WALLET_CONNECT_REQUEST_EVENT, connect);
  }, [connect]);

  const value = React.useMemo(
    () => ({ eligible, dismissed, mainnetUnavailable, open: connect }),
    [eligible, dismissed, mainnetUnavailable, connect]
  );
  const showFloating =
    eligible &&
    !dismissed &&
    !connectModalOpen &&
    !otherOverlay &&
    hydrated &&
    entryCleared &&
    cookieConsent !== null &&
    !rgDialogOpen &&
    pathname === "/casino";

  return (
    <WalletEntryContext.Provider value={value}>
      {children}
      {showFloating ? (
        <aside
          aria-label={t("title")}
          className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[50] grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-brand/50 bg-surface-1 p-4 shadow-e3 md:hidden"
        >
          <WalletIcon className="h-6 w-6 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-fg">{t("title")}</p>
            <p className="text-xs text-fg-muted">
              {t(mainnetUnavailable ? "unavailableHint" : "hint")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("dismiss")}
            onClick={() => {
              setDismissed(true);
              writeSession(DISMISS_KEY, "1");
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-fg-muted"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={connect}
            className="col-span-3 min-h-12 rounded-lg bg-brand px-4 text-base font-bold text-fg-inverse hover:bg-brand-hover"
          >
            {t("choose")}
          </button>
        </aside>
      ) : null}
    </WalletEntryContext.Provider>
  );
}
