"use client";

import * as React from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const OPEN_WALLET_CONNECT_MODAL_EVENT = "ssot-open-wallet-connect-modal";

export function useConnectModal() {
  const { connect, connectors, isPending } = useConnect();

  const openConnectModal = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(OPEN_WALLET_CONNECT_MODAL_EVENT));
      return;
    }
    const connector = connectors[0];
    if (!connector) return;
    connect({ connector });
  }, [connect, connectors]);

  return { openConnectModal, isConnecting: isPending };
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal, isConnecting } = useConnectModal();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-surface-1 px-4 py-2 text-sm font-bold text-fg transition hover:bg-surface-2"
      >
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openConnectModal}
      disabled={isConnecting}
      className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-bold text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
