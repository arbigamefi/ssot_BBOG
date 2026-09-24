"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@ssot/ui";

import { useOverlayController } from "./use-overlay-controller";
import { overlayZ } from "./z";

export function Modal({
  ariaLabel,
  children,
  className,
  closeOnBackdrop = false,
  initialFocusRef,
  onClose,
  open,
  panelClassName
}: {
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
  onClose: () => void;
  open: boolean;
  panelClassName?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  const { onBackdropMouseDown, panelRef } = useOverlayController<HTMLDivElement>({
    lockScroll: true,
    onClose,
    open: mounted && open,
    trapFocus: true
  });

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!mounted || !open) return;
    const frame = window.requestAnimationFrame(() => initialFocusRef?.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [initialFocusRef, mounted, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-surface-0/76 p-4 backdrop-blur-md animate-in fade-in zoom-in",
        overlayZ.modal,
        className
      )}
      role="presentation"
      onMouseDown={closeOnBackdrop ? onBackdropMouseDown : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={panelClassName}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
