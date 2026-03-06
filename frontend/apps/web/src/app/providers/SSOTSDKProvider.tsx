"use client";

import * as React from "react";
import { createSSOTSDK } from "@ssot/ssot/sdk";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { SDKContext, type SDKContextValue } from "../../ssot/sdk";
import { useSSOTRuntime } from "../../ssot/runtime";

/**
 * SSOTSDKProvider
 *
 * Provider wiring ONLY (allowed to import wagmi).
 * - Exposes a memoized SSOT SDK instance to feature/UI code.
 * - SDK implementation uses viem directly; feature code MUST NOT.
 */
export function SSOTSDKProvider({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  const { address } = useAccount();
  const rel = useRelease();
  const runtime = useSSOTRuntime();

  const sdk = React.useMemo(() => {
    if (!rel.release) return undefined;
    return createSSOTSDK({
      release: rel.release,
      publicClient: publicClient as any,
      walletClient: walletClient as any,
      account: address as any,
      journal: runtime.journal
    });
  }, [rel.release, publicClient, walletClient, address, runtime.journal]);

  const value = React.useMemo<SDKContextValue>(
    () => ({ sdk, ready: Boolean(sdk), readOnly: rel.readOnly }),
    [sdk, rel.readOnly]
  );

  return <SDKContext.Provider value={value}>{children}</SDKContext.Provider>;
}
