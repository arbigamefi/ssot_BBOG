"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ClipboardDocumentCheckIcon, ShareIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { Sheet } from "../../components/overlay";
import { overlayZ } from "../../components/overlay/z";
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
  desktopLayer = "popover",
  labels,
  proof,
  text,
  title,
  triggerClassName,
  url
}: {
  disabled?: boolean;
  desktopLayer?: "popover" | "modal";
  labels: SharePanelLabels;
  proof?: string;
  text: string;
  title: string;
  triggerClassName?: string;
  url: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState<"link" | "proof" | null>(null);
  const [popoverAlign, setPopoverAlign] = React.useState<"end" | "start">("end");
  const useMobileSheet = useMobileShareSheet();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const desktopPanelRef = React.useRef<HTMLDivElement | null>(null);
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  React.useEffect(() => {
    if (!open || useMobileSheet) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = Math.min(288, window.innerWidth - 32);
      setPopoverAlign(rect.left + menuWidth <= window.innerWidth - 16 ? "start" : "end");
      setTriggerRect(rect);
    }
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !desktopPanelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, useMobileSheet]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
          {useMobileSheet ? (
            <Sheet
              closeLabel={labels.close ?? labels.share}
              layerClassName={desktopLayer === "modal" ? overlayZ.modalPopover : undefined}
              onClose={() => setOpen(false)}
              open={open}
              subtitle={url}
              title={labels.share}
            >
              <div role="menu" className="space-y-1">
                {menuItems}
              </div>
            </Sheet>
          ) : (
            <DesktopSharePopover
              align={popoverAlign}
              anchorRect={triggerRect}
              layer={desktopLayer}
              panelRef={desktopPanelRef}
            >
              {menuItems}
            </DesktopSharePopover>
          )}
        </>
      ) : null}
    </div>
  );
}

function DesktopSharePopover({
  align,
  anchorRect,
  children,
  layer,
  panelRef
}: {
  align: "end" | "start";
  anchorRect: DOMRect | null;
  children: React.ReactNode;
  layer: "popover" | "modal";
  panelRef: React.RefObject<HTMLDivElement>;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [panelHeight, setPanelHeight] = React.useState(0);

  React.useEffect(() => setMounted(true), []);
  React.useLayoutEffect(() => {
    if (!mounted) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) setPanelHeight(rect.height);
  }, [mounted, panelRef]);

  if (!mounted || !anchorRect) return null;

  const width = Math.min(288, window.innerWidth - 32);
  const left =
    align === "start"
      ? Math.min(Math.max(16, anchorRect.left), window.innerWidth - width - 16)
      : Math.min(Math.max(16, anchorRect.right - width), window.innerWidth - width - 16);
  const canRenderAbove = anchorRect.top > panelHeight + 16;
  const top = canRenderAbove ? anchorRect.top - 8 : anchorRect.bottom + 8;

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      className={cn(
        "fixed hidden overflow-hidden rounded-lg border border-border-soft bg-surface-1 p-1 text-left shadow-e3 md:block",
        layer === "modal" ? overlayZ.modalPopover : overlayZ.popover
      )}
      style={{
        left,
        top,
        width,
        transform: canRenderAbove ? "translateY(-100%)" : undefined
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function useMobileShareSheet() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 767px)");
    if (!query) return;
    const sync = () => setIsMobile(Boolean(query.matches));
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
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
