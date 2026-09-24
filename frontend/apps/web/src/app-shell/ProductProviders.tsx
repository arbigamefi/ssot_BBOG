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
  defaultChainId,
  sportsbookEnabledFlag
}: {
  children: React.ReactNode;
  defaultChainId?: string;
  sportsbookEnabledFlag?: string;
}) {
  return (
    // ComplianceProvider sits above analytics so consent can gate tracking.
    <ComplianceProvider>
      <ActiveChainProvider initialChainId={defaultChainId}>
        <WalletProviderIsland>
          <AnalyticsProvider>
            <ReleaseProviderWagmi sportsbookEnabledFlag={sportsbookEnabledFlag}>
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
