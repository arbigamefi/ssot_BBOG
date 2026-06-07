/**
 * CSS custom property published by `StickyActionBar` with its live height, so
 * bottom-anchored banners (cookie consent, PWA install) can stack *above* the
 * sticky bet/connect CTA instead of covering it. Falls back to the safe-area
 * inset when no sticky bar is mounted.
 */
export const stickyActionHeightVar = "--agf-sticky-action-height";

/**
 * Single source of truth for overlay stacking. One scale for every layered
 * surface so they stack predictably and never collide:
 *
 *   stickyAction  bottom bet/connect CTA (behind banners)
 *   bottomBanner  cookie consent, PWA install (above the sticky CTA)
 *   popover       desktop anchored menus
 *   drawer        mobile nav drawer
 *   sheet         mobile bottom sheets
 *   onboarding    first-run coachmark tour
 *   modal         result / confirmation modals
 *   modalPopover  a popover opened from inside a modal (e.g. share-from-result)
 *   toast         transient notifications
 *   gate          blocking legal surfaces (age/terms, responsible gambling) —
 *                 above everything, including toasts
 */
export const overlayZ = {
  stickyAction: "z-[40]",
  bottomBanner: "z-[50]",
  popover: "z-[60]",
  drawer: "z-[70]",
  sheet: "z-[80]",
  onboarding: "z-[85]",
  modal: "z-[90]",
  modalPopover: "z-[95]",
  toast: "z-[100]",
  gate: "z-[110]"
} as const;
