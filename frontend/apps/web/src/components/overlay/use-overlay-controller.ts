"use client";

import * as React from "react";

import { useFocusTrap } from "../../app-shell/a11y/useFocusTrap";

export function useOverlayController<T extends HTMLElement>({
  lockScroll = false,
  onClose,
  open,
  trapFocus = false
}: {
  lockScroll?: boolean;
  onClose: () => void;
  open: boolean;
  trapFocus?: boolean;
}) {
  const panelRef = useFocusTrap<T>(open && trapFocus);

  React.useEffect(() => {
    if (!open || !lockScroll) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockScroll, open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const onBackdropMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose]
  );

  return { onBackdropMouseDown, panelRef };
}
