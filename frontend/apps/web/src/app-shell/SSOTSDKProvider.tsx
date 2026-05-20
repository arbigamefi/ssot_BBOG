"use client";

import * as React from "react";
import { createSSOTSDK } from "@ssot/ssot/sdk";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { SDKContext, type SDKContextValue } from "../ssot/sdk";
import { useSSOTRuntime } from "../ssot/runtime";

export function SSOTSDKProvider({ children }: { children: React.ReactNode }) {
  const connectedChainId = useChainId();
  const rel = useRelease();
  const releaseChainId = rel.release?.chainId ?? rel.chainId ?? connectedChainId;
  const publicClient = usePublicClient({ chainId: releaseChainId });
  const { data: walletClient } = useWalletClient({ chainId: releaseChainId });
  const { address } = useAccount();
  const runtime = useSSOTRuntime();

  const sdk = React.useMemo(() => {
    if (!rel.release) return undefined;
    return createSSOTSDK({
      account: address as any,
      journal: runtime.journal,
      publicClient: publicClient as any,
      release: rel.release,
      walletClient: walletClient as any
    });
  }, [rel.release, publicClient, walletClient, address, runtime.journal]);

  const value = React.useMemo<SDKContextValue>(
    () => ({ readOnly: rel.readOnly, ready: Boolean(sdk), sdk }),
    [sdk, rel.readOnly]
  );

  return <SDKContext.Provider value={value}>{children}</SDKContext.Provider>;
}
