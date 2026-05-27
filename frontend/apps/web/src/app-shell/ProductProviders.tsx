"use client";

import * as React from "react";

import { AnalyticsProvider } from "./AnalyticsProvider";
import { ActiveChainProvider } from "./ActiveChainProvider";
import { ReleaseProviderWagmi } from "./ReleaseProviderWagmi";
import { SSOTRuntimeProvider } from "./SSOTRuntimeProvider";
import { SSOTSDKProvider } from "./SSOTSDKProvider";
import { WalletProviderIsland } from "./WalletProviderIsland";

export function ProductProviders({
  children,
  defaultChainId,
  sportsbookEnabledFlag
}: {
  children: React.ReactNode;
  defaultChainId?: string;
  sportsbookEnabledFlag?: string;
}) {
  return (
    <WalletProviderIsland>
      <ActiveChainProvider initialChainId={defaultChainId}>
        <AnalyticsProvider>
          <ReleaseProviderWagmi sportsbookEnabledFlag={sportsbookEnabledFlag}>
            <SSOTRuntimeProvider>
              <SSOTSDKProvider>{children}</SSOTSDKProvider>
            </SSOTRuntimeProvider>
          </ReleaseProviderWagmi>
        </AnalyticsProvider>
      </ActiveChainProvider>
    </WalletProviderIsland>
  );
}
