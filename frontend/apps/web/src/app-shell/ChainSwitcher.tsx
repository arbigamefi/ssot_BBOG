"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import {
  ArrowsRightLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { useActiveChain } from "./ActiveChainProvider";

/**
 * The chain radio list — selecting one changes the app's active chain (which
 * makes `ReleaseProvider` reload that chain's release). Shared by the wallet
 * header menu and the standalone `ChainSwitcher` so both read identically.
 */
export function ChainOptionList({ onSelect }: { onSelect?: () => void }) {
  const { selectedChainId, supportedChains, setSelectedChainId } = useActiveChain();
  return (
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
              onSelect?.();
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
  );
}

function useBodyScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}

/**
 * Standalone chain switcher (pill trigger + popover) for surfaces without the
 * wallet menu — notably the disconnected header, so a visitor can browse a
 * different chain's games before connecting. Renders nothing when only one
 * chain is supported.
 */
export function ChainSwitcher({
  className,
  mode = "popover",
  triggerClassName
}: {
  className?: string;
  mode?: "popover" | "sheet";
  triggerClassName?: string;
}) {
  // walletMenu.* / network.* live under the "app" namespace (same as WalletHeaderMenu).
  const t = useTranslations("app");
  const rootT = useTranslations();
  const { selectedChain, supportedChains } = useActiveChain();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const isSheet = mode === "sheet";
  useBodyScrollLock(isSheet && open);

  React.useEffect(() => {
    if (!open || isSheet) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isSheet, open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (supportedChains.length <= 1) return null;

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-haspopup={isSheet ? "dialog" : "menu"}
      aria-expanded={open}
      aria-label={t("walletMenu.chainSection")}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-md border border-border-soft bg-surface-1 px-3 py-2 text-sm font-semibold text-fg transition hover:bg-surface-2",
        isSheet && "w-full justify-between rounded-lg",
        triggerClassName
      )}
    >
      {isSheet ? (
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border-soft bg-surface-1 text-fg-muted">
            <ArrowsRightLeftIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {t("walletMenu.chainSection")}
            </span>
            <span className="mt-0.5 flex items-center gap-2 truncate font-semibold text-fg">
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  selectedChain?.environment === "mainnet" ? "bg-brand" : "bg-accent"
                )}
              />
              {selectedChain?.shortName ?? t("network.label")}
            </span>
          </span>
        </span>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              selectedChain?.environment === "mainnet" ? "bg-brand" : "bg-accent"
            )}
          />
          <span className="hidden truncate sm:inline">
            {selectedChain?.shortName ?? t("network.label")}
          </span>
        </span>
      )}
      <ChevronDownIcon
        className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
      />
    </button>
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {trigger}

      {open && !isSheet && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[16rem] overflow-hidden rounded-xl border border-border-soft bg-surface-1 p-3 shadow-e3"
        >
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
            <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
            {t("walletMenu.chainSection")}
          </div>
          <ChainOptionList onSelect={() => setOpen(false)} />
        </div>
      )}

      {open && isSheet
        ? createPortal(
            <div className="fixed inset-0 z-[95] md:hidden" role="dialog" aria-modal="true">
              <button
                type="button"
                aria-label={rootT("nav.closeMenu")}
                className="absolute inset-0 bg-surface-0/70 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 max-h-[82svh] overflow-y-auto rounded-t-2xl border border-border-soft bg-surface-1 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-e3 animate-in slide-in-from-bottom">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                      <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
                      {t("walletMenu.chainSection")}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-fg">
                      {selectedChain?.name ?? t("network.label")}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={rootT("nav.closeMenu")}
                    onClick={() => setOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-md border border-border-soft bg-surface-2 text-fg-muted transition-colors hover:text-fg"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <ChainOptionList onSelect={() => setOpen(false)} />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function DisconnectedChainSwitcher({
  className,
  mode = "popover",
  triggerClassName
}: {
  className?: string;
  mode?: "popover" | "sheet";
  triggerClassName?: string;
}) {
  const { isConnected } = useAccount();
  if (isConnected) return null;

  return (
    <div className={className}>
      <ChainSwitcher mode={mode} triggerClassName={triggerClassName} />
    </div>
  );
}
