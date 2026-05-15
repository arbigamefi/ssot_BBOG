"use client";

import * as React from "react";

import { AnalyticsProvider } from "./AnalyticsProvider";
import { ReleaseProviderWagmi } from "./ReleaseProviderWagmi";
import { SSOTRuntimeProvider } from "./SSOTRuntimeProvider";
import { SSOTSDKProvider } from "./SSOTSDKProvider";
import { WalletProviderIsland } from "./WalletProviderIsland";

export function ProductProviders({ children }: { children: React.ReactNode }) {
  return (
    <WalletProviderIsland>
      <AnalyticsProvider>
        <ReleaseProviderWagmi>
          <SSOTRuntimeProvider>
            <SSOTSDKProvider>{children}</SSOTSDKProvider>
          </SSOTRuntimeProvider>
        </ReleaseProviderWagmi>
      </AnalyticsProvider>
    </WalletProviderIsland>
  );
}
