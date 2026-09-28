"use client";

import * as React from "react";

export const WalletEntryContext = React.createContext<{
  eligible: boolean;
  dismissed: boolean;
  mainnetUnavailable: boolean;
  open: () => void;
} | null>(null);

export function useWalletEntry() {
  return React.useContext(WalletEntryContext);
}

export function useConnectModal() {
  const entry = useWalletEntry();
  return { openConnectModal: entry?.open };
}
