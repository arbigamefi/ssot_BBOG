"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { mainnet } from "wagmi/chains";
import {
  useAccount,
  useChainId,
  useDisconnect,
  useEnsAvatar,
  useEnsName,
  useSwitchChain
} from "wagmi";
import { normalize } from "viem/ens";
import { cn } from "@ssot/ui";
import {
  ArrowsRightLeftIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  ExclamationTriangleIcon,
  PowerIcon
} from "@heroicons/react/24/outline";

import { useActiveChain } from "./ActiveChainProvider";
import { getExplorerAddressUrl } from "./chain-registry";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Unified header control: replaces the old WalletButton + NetworkSwitcher
 * pair. One trigger button summarises the current state; the popover
 * exposes the full surface area (identity, chain switching, explorer link,
 * wallet-chain mismatch warning, disconnect).
 */
export function WalletHeaderMenu() {
  const t = useTranslations("app");
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { selectedChainId, selectedChain, supportedChains, setSelectedChainId } = useActiveChain();
  const walletChainId = useChainId();
  const { switchChain, isPending: isSwitchingWalletChain } = useSwitchChain();

  // ENS reverse resolution on Ethereum mainnet (resolution-only chain). Falls
  // back silently to the short address when the wallet has no ENS name.
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ? normalize(ensName) : undefined,
    chainId: mainnet.id
  });
  const displayName = ensName ?? (address ? shortAddress(address) : "");

  const walletMismatch = isConnected && walletChainId !== selectedChainId;

  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape — no Radix dep, just light handlers.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        data-tour="wallet"
        onClick={() => openConnectModal?.()}
        disabled={!openConnectModal}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t("connectWalletButton")}
      </button>
    );
  }

  const explorerUrl = getExplorerAddressUrl(selectedChainId, address);

  return (
    <div ref={containerRef} className="relative" data-tour="wallet">
      {/* Trigger ─ chain dot + short address + caret. Mismatch ribbon takes
          over the dot color so the warning is impossible to miss. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-md border bg-surface-1 px-3 py-2 text-sm font-semibold text-fg transition hover:bg-surface-2",
          walletMismatch ? "border-warn/60" : "border-border-soft"
        )}
      >
        {ensAvatar ? (
          <img src={ensAvatar} alt="" className="h-5 w-5 rounded-full object-cover" aria-hidden />
        ) : (
          <span
            aria-hidden
            className={cn(
              "h-2 w-2 rounded-full",
              walletMismatch
                ? "bg-warn"
                : selectedChain?.environment === "mainnet"
                  ? "bg-brand"
                  : "bg-accent"
            )}
          />
        )}
        <span className={cn(ensName ? "" : "font-mono")}>{displayName}</span>
        <ChevronDownIcon className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[20rem] overflow-hidden rounded-xl border border-border-soft bg-surface-1 shadow-e3"
        >
          {/* Identity block — address + copy + explorer + ENS placeholder. */}
          <div className="border-b border-border-soft px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {ensName && (
                  <span className="block truncate text-sm font-bold text-fg">{ensName}</span>
                )}
                <span
                  className={cn(
                    "block truncate font-mono text-fg",
                    ensName ? "text-[11px] text-fg-muted" : "text-sm font-bold"
                  )}
                >
                  {shortAddress(address)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <CopyButton value={address} t={t} />
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={t("walletMenu.viewOnExplorer")}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border-soft text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
            {connector?.name && (
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
                {t("walletMenu.connectedVia", { wallet: connector.name })}
              </p>
            )}
          </div>

          {/* Wallet-chain mismatch banner — shown ONLY when wallet differs
              from the app's selected chain. Single-click fix. */}
          {walletMismatch && (
            <div className="flex items-center gap-3 border-b border-border-soft bg-warn/8 px-4 py-3">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-warn" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-fg">{t("walletMenu.mismatch.title")}</p>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  {t("walletMenu.mismatch.description", {
                    target: selectedChain?.name ?? `chainId=${selectedChainId}`
                  })}
                </p>
              </div>
              <button
                type="button"
                disabled={isSwitchingWalletChain}
                onClick={() => switchChain({ chainId: selectedChainId })}
                className="shrink-0 rounded-md border border-warn/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-warn transition-colors hover:bg-warn/10 disabled:opacity-60"
              >
                {isSwitchingWalletChain ? t("network.switching") : t("walletMenu.mismatch.switch")}
              </button>
            </div>
          )}

          {/* Chain switcher — mainnet first, testnets after.
              Selecting changes the app's active chain (which triggers
              ReleaseProvider to reload). If the wallet is also on a
              different chain, the mismatch banner above appears next. */}
          <div className="border-b border-border-soft px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
              <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
              {t("walletMenu.chainSection")}
            </div>
            <div role="radiogroup" className="flex flex-col gap-1">
              {supportedChains.map((chain) => {
                const active = chain.id === selectedChainId;
                return (
                  <button
                    key={chain.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSelectedChainId(chain.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-brand bg-brand-soft text-fg"
                        : "border-transparent text-fg-muted hover:border-border-soft hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          chain.environment === "mainnet" ? "bg-brand" : "bg-accent"
                        )}
                      />
                      <span className="font-semibold">{chain.name}</span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
                        {chain.environment}
                      </span>
                    </span>
                    {active && <CheckIcon className="h-4 w-4 text-brand" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Disconnect — destructive style, no double-confirm (cheap to
              re-connect, expensive to nag). */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <PowerIcon className="h-4 w-4" />
            {t("walletMenu.disconnect")}
          </button>
        </div>
      )}
    </div>
  );
}

function CopyButton({ value, t }: { value: string; t: ReturnType<typeof useTranslations> }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={t("walletMenu.copyAddress")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // Clipboard may be denied — fail silently.
        }
      }}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border-soft text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-success" />
      ) : (
        <ClipboardIcon className="h-4 w-4" />
      )}
    </button>
  );
}
