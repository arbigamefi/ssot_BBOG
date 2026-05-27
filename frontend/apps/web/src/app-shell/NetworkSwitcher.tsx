"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { cn } from "@ssot/ui";

import { useActiveChain } from "./ActiveChainProvider";

export function NetworkSwitcher() {
  const t = useTranslations("app");
  const { selectedChainId, selectedChain, setSelectedChainId, supportedChains } = useActiveChain();
  const walletChainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const walletMismatch = isConnected && walletChainId !== selectedChainId;

  if (supportedChains.length === 0) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-border-soft bg-surface-2 px-3 py-1.5 font-mono text-xs text-fg-muted sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        {t("unknownNetwork")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-full border bg-surface-2 px-2.5 py-1.5 sm:px-3",
        walletMismatch ? "border-warn/50" : "border-border-soft"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          selectedChain?.environment === "mainnet" ? "bg-brand" : "bg-accent"
        )}
      />
      <label className="sr-only" htmlFor="app-network-switcher">
        {t("network.label")}
      </label>
      <select
        id="app-network-switcher"
        value={selectedChainId}
        onChange={(event) => setSelectedChainId(Number(event.currentTarget.value))}
        className="max-w-[4.75rem] cursor-pointer appearance-none bg-transparent pr-1 font-mono text-xs font-bold text-fg outline-none sm:max-w-[9rem]"
        title={selectedChain?.name}
      >
        {supportedChains.map((chain) => (
          <option key={chain.id} value={chain.id}>
            {chain.shortName}
          </option>
        ))}
      </select>
      {walletMismatch ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => switchChain({ chainId: selectedChainId })}
          className="rounded-full border border-warn/50 px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-warn transition-colors hover:bg-warn/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? t("network.switching") : t("network.switchWallet")}
        </button>
      ) : null}
    </div>
  );
}
