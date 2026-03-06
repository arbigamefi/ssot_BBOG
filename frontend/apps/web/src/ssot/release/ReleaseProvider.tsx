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
};

const ReleaseContext = React.createContext<ReleaseContextValue | null>(null);

export function ReleaseProvider({ children, chainId }: { children: React.ReactNode; chainId?: number }) {
  const resolvedChainId = chainId ?? embeddedChainIds[0] ?? 84532;
  const value = React.useMemo<ReleaseContextValue>(() => {
    const r = loadEmbeddedRelease(resolvedChainId);
    if (!r.ok) {
      return {
        chainId: resolvedChainId,
        warnings: [],
        readOnly: true,
        readOnlyReason: r.error,
      };
    }
    const release = r.release;
    const warnings = r.warnings;

    const readOnly = warnings.length > 0;
    const readOnlyReason = readOnly ? "Release snapshot is not usable for writes." : undefined;

    return { chainId: resolvedChainId, release, warnings, readOnly, readOnlyReason };
  }, [resolvedChainId]);

  return <ReleaseContext.Provider value={value}>{children}</ReleaseContext.Provider>;
}

export function useRelease() {
  const ctx = React.useContext(ReleaseContext);
  if (!ctx) throw new Error("useRelease must be used within ReleaseProvider");
  return ctx;
}
