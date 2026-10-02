"use client";

import * as React from "react";
import { useAccount } from "wagmi";

import { ReleaseProvider } from "../ssot/release/ReleaseProvider";
import { useActiveChain } from "./ActiveChainProvider";

export function ReleaseProviderWagmi({
  children,
  sportsbookEnabledFlag
}: {
  children: React.ReactNode;
  sportsbookEnabledFlag?: string;
}) {
  const { selectedChainId, selectedChain } = useActiveChain();
  const { isConnected, chainId: walletChainId } = useAccount();
  return (
    <ReleaseProvider
      chainId={selectedChainId}
      selectedChainName={selectedChain?.name}
      walletChainId={isConnected ? walletChainId : undefined}
      sportsbookEnabledFlag={sportsbookEnabledFlag}
    >
      {children}
    </ReleaseProvider>
  );
}
