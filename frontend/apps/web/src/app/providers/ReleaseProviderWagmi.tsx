"use client";

import * as React from "react";
import { useChainId } from "wagmi";

import { ReleaseProvider } from "../../ssot/release/ReleaseProvider";

/**
 * Chain-aware ReleaseProvider.
 *
 * Provider wiring only (allowed to import wagmi).
 * Drives the embedded release selection from the currently connected wallet chain.
 */
export function ReleaseProviderWagmi({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  return <ReleaseProvider chainId={chainId}>{children}</ReleaseProvider>;
}
