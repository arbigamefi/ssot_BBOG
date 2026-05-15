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
  sportsbook: SportsbookAccess;
};

export type SportsbookAccess = {
  enabled: boolean;
  frontendEnabled: boolean;
  hasSportsRelease: boolean;
  enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED";
  disabledReason?: string;
};

const ReleaseContext = React.createContext<ReleaseContextValue | null>(null);

const SPORTSBOOK_ENABLEMENT_FLAG = "NEXT_PUBLIC_SPORTSBOOK_ENABLED" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isTruthyFeatureFlag(value: string | undefined) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

export function resolveSportsbookAccess(
  release: SSOTRelease | undefined,
  rawFlag?: string
): SportsbookAccess {
  const frontendEnabled = isTruthyFeatureFlag(rawFlag);
  const sportsHub = release?.sports?.sportsHub ?? release?.contracts.sportsHub;
  const hasSportsRelease =
    release?.sports?.enabled === true && Boolean(sportsHub && sportsHub !== ZERO_ADDRESS);

  if (!frontendEnabled) {
    return {
      enabled: false,
      frontendEnabled,
      hasSportsRelease,
      enablementFlag: SPORTSBOOK_ENABLEMENT_FLAG,
      disabledReason: `${SPORTSBOOK_ENABLEMENT_FLAG} is not true.`
    };
  }

  if (!hasSportsRelease) {
    return {
      enabled: false,
      frontendEnabled,
      hasSportsRelease,
      enablementFlag: SPORTSBOOK_ENABLEMENT_FLAG,
      disabledReason: "The active release does not expose enabled SportsHub metadata."
    };
  }

  return {
    enabled: true,
    frontendEnabled,
    hasSportsRelease,
    enablementFlag: SPORTSBOOK_ENABLEMENT_FLAG
  };
}

export function ReleaseProvider({
  children,
  chainId
}: {
  children: React.ReactNode;
  chainId?: number;
}) {
  const resolvedChainId = chainId ?? embeddedChainIds[0] ?? 84532;
  const value = React.useMemo<ReleaseContextValue>(() => {
    const r = loadEmbeddedRelease(resolvedChainId);
    if (!r.ok) {
      return {
        chainId: resolvedChainId,
        warnings: [],
        readOnly: true,
        readOnlyReason: r.error,
        sportsbook: resolveSportsbookAccess(undefined, process.env.NEXT_PUBLIC_SPORTSBOOK_ENABLED)
      };
    }
    const release = r.release;
    const warnings = r.warnings;
    const sportsbook = resolveSportsbookAccess(release, process.env.NEXT_PUBLIC_SPORTSBOOK_ENABLED);

    const readOnly = warnings.length > 0;
    const readOnlyReason = readOnly ? "Release snapshot is not usable for writes." : undefined;

    return { chainId: resolvedChainId, release, warnings, readOnly, readOnlyReason, sportsbook };
  }, [resolvedChainId]);

  return <ReleaseContext.Provider value={value}>{children}</ReleaseContext.Provider>;
}

export function useRelease() {
  const ctx = React.useContext(ReleaseContext);
  if (!ctx) throw new Error("useRelease must be used within ReleaseProvider");
  return ctx;
}
