"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  CheckIcon,
  ClipboardDocumentCheckIcon,
  ShareIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { buildShareIntentUrl } from "./share-link";

export type SharePanelLabels = {
  close?: string;
  copyLink: string;
  copyProof?: string;
  linkCopied: string;
  nativeShare: string;
  proofCopied?: string;
  share: string;
  telegram: string;
  whatsapp: string;
  x: string;
};

export function SharePanel({
  disabled = false,
  labels,
  proof,
  text,
  title,
  triggerClassName,
  url
}: {
  disabled?: boolean;
  labels: SharePanelLabels;
  proof?: string;
  text: string;
  title: string;
  triggerClassName?: string;
  url: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState<"link" | "proof" | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const useMobileSheet = useMobileShareSheet();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mobileSheetRef = React.useRef<HTMLDivElement | null>(null);
  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !mobileSheetRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  React.useEffect(() => {
    if (!open || !useMobileSheet) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, useMobileSheet]);

  const markCopied = (kind: "link" | "proof") => {
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyText = async (value: string, kind: "link" | "proof") => {
    try {
      await navigator.clipboard.writeText(value);
      markCopied(kind);
      setOpen(false);
    } catch {
      // clipboard denied — keep the menu open so the user can choose another route.
    }
  };

  const shareNative = async () => {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (!canNativeShare || !nav?.share) return;
    try {
      await nav.share({ title, text, url });
      setOpen(false);
    } catch {
      // native share sheet dismissed — nothing to do
    }
  };

  const openIntent = (platform: "telegram" | "whatsapp" | "x") => {
    window.open(buildShareIntentUrl({ platform, text, url }), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const menuItems = (
    <>
      {canNativeShare ? (
        <ShareMenuButton label={labels.nativeShare} onClick={() => void shareNative()} />
      ) : null}
      <ShareMenuButton
        icon="copy"
        label={labels.copyLink}
        onClick={() => void copyText(url, "link")}
      />
      {proof && labels.copyProof ? (
        <ShareMenuButton
          icon="copy"
          label={labels.copyProof}
          onClick={() => void copyText(proof, "proof")}
        />
      ) : null}
      <ShareMenuButton label={labels.x} onClick={() => openIntent("x")} />
      <ShareMenuButton label={labels.telegram} onClick={() => openIntent("telegram")} />
      <ShareMenuButton label={labels.whatsapp} onClick={() => openIntent("whatsapp")} />
    </>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-surface-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/40 hover:bg-surface-3",
          disabled && "cursor-not-allowed opacity-50 hover:border-border-soft hover:bg-surface-2",
          triggerClassName
        )}
      >
        {copied ? (
          <>
            <CheckIcon className="h-4 w-4 text-success" />
            {copied === "proof" ? (labels.proofCopied ?? labels.linkCopied) : labels.linkCopied}
          </>
        ) : (
          <>
            <ShareIcon className="h-4 w-4" />
            {labels.share}
          </>
        )}
      </button>
      {open && !disabled ? (
        <>
          <div
            role="menu"
            className="absolute bottom-full right-0 z-10 mb-2 hidden w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border-soft bg-surface-1 p-1 text-left shadow-e3 sm:block"
          >
            {menuItems}
          </div>
          {mounted && useMobileSheet
            ? createPortal(
                <div
                  className="fixed inset-0 z-[150] flex items-end bg-bg/65 backdrop-blur-sm sm:hidden"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setOpen(false);
                  }}
                >
                  <div
                    ref={mobileSheetRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={labels.share}
                    className="w-full rounded-t-xl border border-border-soft bg-surface-1 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-e3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-fg">{labels.share}</div>
                        <div className="mt-1 max-w-[18rem] truncate text-xs text-fg-muted">
                          {url}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={labels.close ?? labels.share}
                        onClick={() => setOpen(false)}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border-soft bg-surface-2 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <div role="menu" className="space-y-1">
                      {menuItems}
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}
        </>
      ) : null}
    </div>
  );
}

function useMobileShareSheet() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

function ShareMenuButton({
  icon = "share",
  label,
  onClick
}: {
  icon?: "copy" | "share";
  label: string;
  onClick: () => void;
}) {
  const Icon = icon === "copy" ? ClipboardDocumentCheckIcon : ShareIcon;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:min-h-0 sm:gap-2 sm:py-2 sm:text-xs"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
