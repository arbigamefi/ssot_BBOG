"use client";

import * as React from "react";

import { AnalyticsProvider } from "./AnalyticsProvider";
import { ReleaseProviderWagmi } from "./ReleaseProviderWagmi";
import { SSOTRuntimeProvider } from "./SSOTRuntimeProvider";
import { SSOTSDKProvider } from "./SSOTSDKProvider";
import { WalletProviderIsland } from "./WalletProviderIsland";

export function ProductProviders({
  children,
  sportsbookEnabledFlag
}: {
  children: React.ReactNode;
  sportsbookEnabledFlag?: string;
}) {
  return (
    <WalletProviderIsland>
      <AnalyticsProvider>
        <ReleaseProviderWagmi sportsbookEnabledFlag={sportsbookEnabledFlag}>
          <SSOTRuntimeProvider>
            <SSOTSDKProvider>{children}</SSOTSDKProvider>
          </SSOTRuntimeProvider>
        </ReleaseProviderWagmi>
      </AnalyticsProvider>
    </WalletProviderIsland>
  );
}
