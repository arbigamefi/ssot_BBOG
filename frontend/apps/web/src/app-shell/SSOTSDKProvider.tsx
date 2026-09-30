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
  const { address, chainId: walletChainId } = useAccount();
  const runtime = useSSOTRuntime();

  const walletMatches = Boolean(
    address &&
    walletChainId === releaseChainId &&
    walletClient?.chain?.id === releaseChainId &&
    walletClient?.account?.address.toLowerCase() === address.toLowerCase()
  );
  // Each context gets a distinct identity. Switching away and back must never
  // revive a pending operation that captured the previous signing context.
  const signingContext = React.useMemo(
    () => ({ valid: walletMatches && !rel.readOnly }),
    [address, walletChainId, releaseChainId, walletClient, rel.release, rel.readOnly, walletMatches]
  );
  const currentContext = React.useRef<typeof signingContext | undefined>(signingContext);
  currentContext.current = signingContext;
  React.useEffect(() => {
    currentContext.current = signingContext;
    return () => {
      currentContext.current = undefined;
    };
  }, [signingContext]);

  const sdk = React.useMemo(() => {
    if (!rel.release) return undefined;
    return createSSOTSDK({
      account: address as any,
      journal: runtime.journal,
      publicClient: publicClient as any,
      release: rel.release,
      walletClient: walletClient as any,
      assertWalletContext: () => {
        if (currentContext.current !== signingContext || !signingContext.valid) {
          throw Object.assign(
            new Error("The wallet or release changed. Review the current action."),
            {
              name: "WalletContextChangedError"
            }
          );
        }
      }
    });
  }, [rel.release, publicClient, walletClient, address, runtime.journal, signingContext]);

  const value = React.useMemo<SDKContextValue>(
    // Reconnection restores the address before the signing client. Do not enable
    // wallet actions with an SDK that still captures an absent walletClient.
    () => ({ readOnly: rel.readOnly, ready: Boolean(sdk && (!address || walletMatches)), sdk }),
    [sdk, rel.readOnly, address, walletMatches]
  );

  return <SDKContext.Provider value={value}>{children}</SDKContext.Provider>;
}
