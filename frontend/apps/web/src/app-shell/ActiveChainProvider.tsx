"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { getSupportedAppChains, resolveDefaultAppChainId, type AppChain } from "./chain-registry";

const STORAGE_KEY = "arbigamefi.activeChainId.v1";

type ActiveChainContextValue = {
  selectedChainId: number;
  selectedChain?: AppChain;
  supportedChains: AppChain[];
  setSelectedChainId: (chainId: number) => void;
};

const ActiveChainContext = React.createContext<ActiveChainContextValue | null>(null);

function readStoredChainId(supportedChains: AppChain[]) {
  if (typeof window === "undefined") return undefined;
  const parsed = Number(window.localStorage.getItem(STORAGE_KEY));
  if (!Number.isInteger(parsed)) return undefined;
  return supportedChains.some((chain) => chain.id === parsed) ? parsed : undefined;
}

function readUrlChainId(supportedChains: AppChain[]) {
  if (typeof window === "undefined") return undefined;
  const receiptChain = /^\/casino\/receipt\/([0-9]+)\//.exec(window.location.pathname)?.[1];
  const parsed = Number(receiptChain ?? new URLSearchParams(window.location.search).get("chainId"));
  if (!Number.isInteger(parsed)) return undefined;
  return supportedChains.some((chain) => chain.id === parsed) ? parsed : undefined;
}

export function ActiveChainProvider({
  children,
  initialChainId
}: {
  children: React.ReactNode;
  initialChainId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString();
  const supportedChains = React.useMemo(() => getSupportedAppChains(), []);
  const defaultChainId = React.useMemo(
    () => resolveDefaultAppChainId(initialChainId ?? process.env.NEXT_PUBLIC_CHAIN_ID),
    [initialChainId]
  );
  const [selectedChainId, setSelectedChainIdState] = React.useState(defaultChainId);

  React.useEffect(() => {
    const applyLocationOrStoredChain = () => {
      const urlChainId = readUrlChainId(supportedChains);
      if (urlChainId) {
        setSelectedChainIdState(urlChainId);
        window.localStorage.setItem(STORAGE_KEY, String(urlChainId));
        return;
      }

      const storedChainId = readStoredChainId(supportedChains);
      if (storedChainId) setSelectedChainIdState(storedChainId);
    };

    applyLocationOrStoredChain();
    window.addEventListener("popstate", applyLocationOrStoredChain);
    return () => window.removeEventListener("popstate", applyLocationOrStoredChain);
  }, [supportedChains, pathname, query]);

  const setSelectedChainId = React.useCallback(
    (chainId: number) => {
      if (!supportedChains.some((chain) => chain.id === chainId)) return;
      setSelectedChainIdState(chainId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(chainId));
      }
    },
    [supportedChains]
  );

  const selectedChain = React.useMemo(
    () => supportedChains.find((chain) => chain.id === selectedChainId),
    [selectedChainId, supportedChains]
  );

  const value = React.useMemo<ActiveChainContextValue>(
    () => ({ selectedChainId, selectedChain, setSelectedChainId, supportedChains }),
    [selectedChainId, selectedChain, setSelectedChainId, supportedChains]
  );

  return <ActiveChainContext.Provider value={value}>{children}</ActiveChainContext.Provider>;
}

export function useActiveChain() {
  const ctx = React.useContext(ActiveChainContext);
  if (!ctx) throw new Error("useActiveChain must be used within ActiveChainProvider");
  return ctx;
}
