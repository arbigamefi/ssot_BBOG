"use client";

import * as React from "react";
import { WalletEntryContext } from "./wallet-entry-context";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useActiveChain } from "./ActiveChainProvider";
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

export function MobileWalletEntryProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { selectedChainId } = useActiveChain();
  const [eligibleBrowser, setEligibleBrowser] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
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
  return <WalletEntryContext.Provider value={value}>{children}</WalletEntryContext.Provider>;
}
