"use client";

import * as React from "react";

import { useFocusTrap } from "../../app-shell/a11y/useFocusTrap";

const openOverlays: symbol[] = [];
const scrollLocks = new Set<symbol>();
let unlockedOverflow = "";

export function useOverlayController<T extends HTMLElement>({
  mobileOnly = false,
  lockScroll = false,
  onClose,
  open,
  trapFocus = false
}: {
  mobileOnly?: boolean;
  lockScroll?: boolean;
  onClose: () => void;
  open: boolean;
  trapFocus?: boolean;
}) {
  const panelRef = useFocusTrap<T>(open && trapFocus);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!open || !lockScroll) return;
    const token = Symbol();
    if (scrollLocks.size === 0) unlockedOverflow = document.body.style.overflow;
    scrollLocks.add(token);
    document.body.style.overflow = "hidden";
    return () => {
      scrollLocks.delete(token);
      if (scrollLocks.size === 0) document.body.style.overflow = unlockedOverflow;
    };
  }, [lockScroll, open]);

  React.useEffect(() => {
    if (!open) return;
    const token = Symbol();
    openOverlays.push(token);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openOverlays.at(-1) === token) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openOverlays.indexOf(token);
      if (index !== -1) openOverlays.splice(index, 1);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !mobileOnly || typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeHiddenOverlay = () => {
      if (desktop.matches) onCloseRef.current();
    };
    closeHiddenOverlay();
    desktop.addEventListener("change", closeHiddenOverlay);
    return () => desktop.removeEventListener("change", closeHiddenOverlay);
  }, [mobileOnly, open]);

  const onBackdropMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose]
  );

  return { onBackdropMouseDown, panelRef };
}
