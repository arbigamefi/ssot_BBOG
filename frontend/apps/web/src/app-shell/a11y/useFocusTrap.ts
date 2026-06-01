"use client";

import * as React from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

/**
 * Trap keyboard focus inside `ref` while `active`. On activate, focus moves
 * into the container; Tab / Shift+Tab cycle within it; on deactivate, focus
 * returns to whatever was focused before. This is mandatory for blocking
 * overlays (age gate, dialogs) so keyboard and screen-reader users can't Tab
 * out into the inert page behind them.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Note: we intentionally don't filter by `offsetParent`/layout visibility.
    // jsdom does no layout (offsetParent is always null), and these overlays
    // don't contain conditionally-hidden focusables, so the disabled-aware
    // selector is sufficient and works in both jsdom and real browsers.
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true"
      );

    // Move focus inside on open.
    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeEl === firstEl || !container.contains(activeEl)) {
          event.preventDefault();
          lastEl.focus();
        }
      } else if (activeEl === lastEl || !container.contains(activeEl)) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Restore focus to the trigger on close.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return ref;
}
