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

import { Popover, Sheet } from "../components/overlay";
import { useActiveChain } from "./ActiveChainProvider";
import { ChainOptionList, ChainSwitcher } from "./ChainSwitcher";
import { getExplorerAddressUrl } from "./chain-registry";
import { WALLET_CONNECT_REQUEST_EVENT } from "./wallet-connect-events";

const ENS_LOOKUP_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ENS_LOOKUP === "true";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Unified header control: replaces the old WalletButton + NetworkSwitcher
 * pair. One trigger button summarises the current state; the popover
 * exposes the full surface area (identity, chain switching, explorer link,
 * wallet-chain mismatch warning, disconnect).
 */
export function WalletHeaderMenu({
  hideDisconnectedChainSwitcher = false,
  mode = "popover",
  compactDisconnectedLabel = false
}: {
  hideDisconnectedChainSwitcher?: boolean;
  mode?: "popover" | "sheet";
  compactDisconnectedLabel?: boolean;
}) {
  const t = useTranslations("app");
  const rootT = useTranslations();
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { selectedChainId, selectedChain } = useActiveChain();
  const walletChainId = useChainId();
  const { switchChain, isPending: isSwitchingWalletChain } = useSwitchChain();

  // ENS reverse resolution is nice-to-have identity chrome, not a product
  // dependency. Keep it opt-in so the header does not add Ethereum mainnet RPC
  // calls to every connected wallet session by default.
  const shouldResolveEns = ENS_LOOKUP_ENABLED && Boolean(address);
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
    query: { enabled: shouldResolveEns, retry: false }
  });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ? normalize(ensName) : undefined,
    chainId: mainnet.id,
    query: { enabled: ENS_LOOKUP_ENABLED && Boolean(ensName), retry: false }
  });
  const displayName = ensName ?? (address ? shortAddress(address) : "");

  const walletMismatch = isConnected && walletChainId !== selectedChainId;

  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const isSheet = mode === "sheet";

  // Close on outside click / Escape — no Radix dep, just light handlers.
  React.useEffect(() => {
    if (!open || isSheet) return;
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
  }, [isSheet, open]);

  React.useEffect(() => {
    const onWalletConnectRequest = () => openConnectModal?.();
    window.addEventListener(WALLET_CONNECT_REQUEST_EVENT, onWalletConnectRequest);
    return () => window.removeEventListener(WALLET_CONNECT_REQUEST_EVENT, onWalletConnectRequest);
  }, [openConnectModal]);

  if (!isConnected || !address) {
    const connectLabel = compactDisconnectedLabel
      ? t("connectWalletShort")
      : t("connectWalletButton");

    return (
      <div className="flex items-center gap-2">
        {/* Lets a visitor browse a different chain's games before connecting. */}
        {!hideDisconnectedChainSwitcher && <ChainSwitcher />}
        <button
          type="button"
          data-tour="wallet"
          onClick={() => openConnectModal?.()}
          disabled={!openConnectModal}
          className={cn(
            "inline-flex min-h-10 items-center justify-center gap-2 rounded-md py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
            compactDisconnectedLabel
              ? "border border-brand/45 bg-surface-2 px-3.5 text-fg shadow-e1 hover:border-brand hover:bg-surface-3"
              : "bg-brand px-4 text-fg-inverse shadow-glow hover:bg-brand-hover"
          )}
        >
          {connectLabel}
        </button>
      </div>
    );
  }

  const explorerUrl = getExplorerAddressUrl(selectedChainId, address);
  const identityBlock = (
    <div className="border-b border-border-soft px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {ensName && <span className="block truncate text-sm font-bold text-fg">{ensName}</span>}
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
  );
  const actionContent = (
    <>
      {/* Mobile sheet already uses the identity as its title; desktop popover
          keeps the full identity block above the actions. */}
      {!isSheet ? identityBlock : null}

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
        <ChainOptionList onSelect={() => setOpen(false)} />
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
    </>
  );
  const sheetTitle = <span className={cn("font-mono", ensName && "font-sans")}>{displayName}</span>;

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

      {open && !isSheet && (
        <Popover open={open} placement="below" className="w-[20rem] rounded-xl p-0">
          {actionContent}
        </Popover>
      )}

      {isSheet ? (
        <Sheet
          closeLabel={rootT("nav.closeMenu")}
          contentClassName="px-0"
          onClose={() => setOpen(false)}
          open={open}
          subtitle={t("walletMenu.connectedVia", { wallet: connector?.name ?? "wallet" })}
          title={sheetTitle}
        >
          {actionContent}
        </Sheet>
      ) : null}
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
