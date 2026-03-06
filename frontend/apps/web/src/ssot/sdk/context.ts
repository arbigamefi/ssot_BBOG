"use client";

import * as React from "react";
import type { SSOTSDK } from "@ssot/ssot/sdk";

export type SDKContextValue = {
  sdk?: SSOTSDK;
  ready: boolean;
  readOnly: boolean;
};

export const SDKContext = React.createContext<SDKContextValue | null>(null);

export function useSSOTSDK(): SDKContextValue {
  const ctx = React.useContext(SDKContext);
  if (!ctx) throw new Error("useSSOTSDK must be used within SSOTSDKProvider");
  return ctx;
}
