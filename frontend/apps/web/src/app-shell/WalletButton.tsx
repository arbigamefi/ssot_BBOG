"use client";

/**
 * Backward-compatible re-export of the connect-modal hook.
 *
 * The header UI is now `<WalletHeaderMenu>` (unified wallet + chain +
 * network mismatch). The legacy `<WalletButton>` is gone. We keep this
 * file as a thin shim so `ConnectWalletPrompt` and the casino room
 * `pageClient` (both of which already pull `useConnectModal` from here)
 * keep working without import churn.
 *
 * The shim normalises RainbowKit's `openConnectModal?: () => void` shape
 * to the never-undefined contract consumers were written against.
 */
import * as React from "react";
import { useConnectModal as useRainbowConnectModal } from "@rainbow-me/rainbowkit";

export function useConnectModal() {
  const { openConnectModal } = useRainbowConnectModal();
  return React.useMemo(
    () => ({
      openConnectModal: openConnectModal ?? (() => {}),
      isConnecting: false
    }),
    [openConnectModal]
  );
}
