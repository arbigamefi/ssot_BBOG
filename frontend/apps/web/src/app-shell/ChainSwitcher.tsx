"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowsRightLeftIcon, CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
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

/**
 * Standalone chain switcher (pill trigger + popover) for surfaces without the
 * wallet menu — notably the disconnected header, so a visitor can browse a
 * different chain's games before connecting. Renders nothing when only one
 * chain is supported.
 */
export function ChainSwitcher({ className }: { className?: string }) {
  // walletMenu.* / network.* live under the "app" namespace (same as WalletHeaderMenu).
  const t = useTranslations("app");
  const { selectedChain, supportedChains } = useActiveChain();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (supportedChains.length <= 1) return null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("walletMenu.chainSection")}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border-soft bg-surface-1 px-3 py-2 text-sm font-semibold text-fg transition hover:bg-surface-2"
      >
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 rounded-full",
            selectedChain?.environment === "mainnet" ? "bg-brand" : "bg-accent"
          )}
        />
        <span className="hidden sm:inline">{selectedChain?.shortName ?? t("network.label")}</span>
        <ChevronDownIcon className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
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
    </div>
  );
}
