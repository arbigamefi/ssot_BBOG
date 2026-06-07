"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { useOverlayController } from "./use-overlay-controller";
import { overlayZ } from "./z";

export function Sheet({
  children,
  className,
  closeLabel,
  onClose,
  open,
  subtitle,
  title
}: {
  children: React.ReactNode;
  className?: string;
  closeLabel: string;
  onClose: () => void;
  open: boolean;
  subtitle?: React.ReactNode;
  title: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  const titleId = React.useId();
  const { onBackdropMouseDown, panelRef } = useOverlayController<HTMLDivElement>({
    lockScroll: true,
    onClose,
    open,
    trapFocus: true
  });

  React.useEffect(() => setMounted(true), []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-end bg-surface-0/70 backdrop-blur-sm md:hidden",
        overlayZ.sheet
      )}
      role="presentation"
      onMouseDown={onBackdropMouseDown}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "max-h-[82svh] w-full overflow-hidden rounded-t-2xl border border-border-soft bg-surface-1 shadow-e3 animate-in slide-in-from-bottom",
          className
        )}
      >
        <div className="px-4 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="flex items-start justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <div id={titleId} className="text-sm font-semibold text-fg">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 max-w-[20rem] truncate text-xs text-fg-muted">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border-soft bg-surface-2 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(82svh-5.75rem)] overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </section>
    </div>,
    document.body
  );
}
