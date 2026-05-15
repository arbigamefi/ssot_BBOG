"use client";

import * as React from "react";
import { useChainId } from "wagmi";

import { ReleaseProvider } from "../ssot/release/ReleaseProvider";

export function ReleaseProviderWagmi({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  return <ReleaseProvider chainId={chainId}>{children}</ReleaseProvider>;
}
