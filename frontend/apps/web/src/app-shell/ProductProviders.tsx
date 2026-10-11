"use client";

import * as React from "react";

import { AnalyticsProvider } from "./AnalyticsProvider";
import { ActiveChainProvider } from "./ActiveChainProvider";
import { ComplianceProvider } from "./compliance";
import { ReferralAttributionCapture } from "../features/referral/ReferralAttributionCapture";
import { ReleaseProviderWagmi } from "./ReleaseProviderWagmi";
import { SSOTRuntimeProvider } from "./SSOTRuntimeProvider";
import { SSOTSDKProvider } from "./SSOTSDKProvider";
import { WalletProviderIsland } from "./WalletProviderIsland";

export function ProductProviders({
  children,
  defaultChainId
}: {
  children: React.ReactNode;
  defaultChainId?: string;
}) {
  return (
    // ComplianceProvider sits above analytics so consent can gate tracking.
    <ComplianceProvider>
      <ActiveChainProvider initialChainId={defaultChainId}>
        <WalletProviderIsland>
          <AnalyticsProvider>
            <ReleaseProviderWagmi>
              <SSOTRuntimeProvider>
                <SSOTSDKProvider>
                  <ReferralAttributionCapture />
                  {children}
                </SSOTSDKProvider>
              </SSOTRuntimeProvider>
            </ReleaseProviderWagmi>
          </AnalyticsProvider>
        </WalletProviderIsland>
      </ActiveChainProvider>
    </ComplianceProvider>
  );
}
