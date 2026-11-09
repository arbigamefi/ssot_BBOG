"use client";

import * as React from "react";
import type { SSOTSDK } from "@ssot/ssot/sdk";

export type SDKContextValue = {
  sdk?: SSOTSDK;
  ready: boolean;
  readOnly: boolean;
  /** A wallet is connected on another chain than the release's. */
  wrongNetwork?: boolean;
  /** Asks the wallet to switch to the release's chain. */
  switchNetwork?: () => void;
};

export const SDKContext = React.createContext<SDKContextValue | null>(null);

export function useSSOTSDK(): SDKContextValue {
  const ctx = React.useContext(SDKContext);
  if (!ctx) throw new Error("useSSOTSDK must be used within SSOTSDKProvider");
  return ctx;
}
