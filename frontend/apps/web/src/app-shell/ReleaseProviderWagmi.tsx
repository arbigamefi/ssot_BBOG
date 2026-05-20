"use client";

import * as React from "react";
import { useChainId } from "wagmi";

import { ReleaseProvider } from "../ssot/release/ReleaseProvider";

export function ReleaseProviderWagmi({
  children,
  sportsbookEnabledFlag
}: {
  children: React.ReactNode;
  sportsbookEnabledFlag?: string;
}) {
  const chainId = useChainId();
  return (
    <ReleaseProvider chainId={chainId} sportsbookEnabledFlag={sportsbookEnabledFlag}>
      {children}
    </ReleaseProvider>
  );
}
