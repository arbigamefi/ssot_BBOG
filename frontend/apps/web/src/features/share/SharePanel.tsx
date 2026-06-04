"use client";

import * as React from "react";
import { CheckIcon, ClipboardDocumentCheckIcon, ShareIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { buildShareIntentUrl } from "./share-link";

export type SharePanelLabels = {
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
  labels,
  proof,
  text,
  title,
  triggerClassName,
  url
}: {
  labels: SharePanelLabels;
  proof?: string;
  text: string;
  title: string;
  triggerClassName?: string;
  url: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState<"link" | "proof" | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-surface-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/40 hover:bg-surface-3",
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
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-10 mb-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border-soft bg-surface-1 p-1 text-left shadow-e3"
        >
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
        </div>
      ) : null}
    </div>
  );
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
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
