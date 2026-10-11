"use client";

import * as React from "react";
import { loadEmbeddedRelease, type SSOTRelease } from "@ssot/ssot/release";
import { embeddedChainIds } from "@ssot/ssot/release";

type ReleaseContextValue = {
  chainId: number;
  release?: SSOTRelease;
  warnings: string[];
  readOnly: boolean;
  readOnlyReason?: string;
  releaseReadOnly: boolean;
  selectedChainName?: string;
  walletChainId?: number;
  walletChainMismatch: boolean;
};

const ReleaseContext = React.createContext<ReleaseContextValue | null>(null);

export function ReleaseProvider({
  children,
  chainId,
  selectedChainName,
  walletChainId
}: {
  children: React.ReactNode;
  chainId?: number;
  selectedChainName?: string;
  walletChainId?: number;
}) {
  const resolvedChainId = chainId ?? embeddedChainIds[0] ?? 84532;
  const value = React.useMemo<ReleaseContextValue>(() => {
    const walletChainMismatch = Boolean(walletChainId && walletChainId !== resolvedChainId);
    const walletMismatchReason = walletChainMismatch
      ? `Wallet is connected to chainId=${walletChainId}. Switch wallet network to ${
          selectedChainName ?? `chainId=${resolvedChainId}`
        }.`
      : undefined;
    const r = loadEmbeddedRelease(resolvedChainId);
    if (!r.ok) {
      return {
        chainId: resolvedChainId,
        warnings: [],
        readOnly: true,
        readOnlyReason: r.error,
        releaseReadOnly: true,
        selectedChainName,
        walletChainId,
        walletChainMismatch
      };
    }
    const release = r.release;
    const warnings = r.warnings;

    const releaseReadOnly = warnings.length > 0;
    const readOnly = releaseReadOnly || walletChainMismatch;
    const readOnlyReason = walletMismatchReason
      ? walletMismatchReason
      : releaseReadOnly
        ? "Release snapshot is not usable for writes."
        : undefined;

    return {
      chainId: resolvedChainId,
      release,
      warnings,
      readOnly,
      readOnlyReason,
      releaseReadOnly,
      selectedChainName,
      walletChainId,
      walletChainMismatch
    };
  }, [resolvedChainId, selectedChainName, walletChainId]);

  return <ReleaseContext.Provider value={value}>{children}</ReleaseContext.Provider>;
}

export function useRelease() {
  const ctx = React.useContext(ReleaseContext);
  if (!ctx) throw new Error("useRelease must be used within ReleaseProvider");
  return ctx;
}

/** The release context, or null outside a ReleaseProvider (for components that also render bare). */
export function useOptionalRelease() {
  return React.useContext(ReleaseContext);
}
