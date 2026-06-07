"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { useOverlayController } from "./use-overlay-controller";
import { overlayZ } from "./z";

export function Drawer({
  children,
  className,
  closeLabel,
  contentClassName,
  onClose,
  open,
  title
}: {
  children: React.ReactNode;
  className?: string;
  closeLabel: string;
  contentClassName?: string;
  onClose: () => void;
  open: boolean;
  title: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  const titleId = React.useId();
  const { onBackdropMouseDown, panelRef } = useOverlayController<HTMLElement>({
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
        "fixed inset-0 flex justify-end bg-surface-0/70 backdrop-blur-sm md:hidden",
        overlayZ.drawer
      )}
      role="presentation"
      onMouseDown={onBackdropMouseDown}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "flex h-full w-[min(22rem,88vw)] flex-col border-l border-border-soft bg-surface-1 shadow-e3 animate-in slide-in-from-right",
          className
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-soft px-4">
          <div id={titleId} className="min-w-0">
            {title}
          </div>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-soft text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]",
            contentClassName
          )}
        >
          {children}
        </div>
      </aside>
    </div>,
    document.body
  );
}
