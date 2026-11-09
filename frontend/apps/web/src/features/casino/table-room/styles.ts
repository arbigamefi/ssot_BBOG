// Class strings the dice room shares. Ink marks what you can press; on carbon it is paper.
export const FOCUS_ON_PAPER =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";
export const FOCUS_ON_CARBON =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-paper";
export const LINK = "font-semibold underline decoration-1 underline-offset-4";

/** An outlined ink button on paper. */
export const LINE_BUTTON = `inline-grid min-h-10 place-items-center rounded-print whitespace-nowrap border border-ink px-3 text-note font-semibold text-ink hover:bg-ink hover:text-paper disabled:cursor-default disabled:border-thermal disabled:text-thermal disabled:hover:bg-transparent ${FOCUS_ON_PAPER}`;

/** The slip's main button: filled ink, or a quiet outline while it waits. */
export const MAIN_BUTTON = `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-print border border-transparent bg-ink px-4 text-center leading-tight font-semibold text-paper hover:bg-ink-bright disabled:cursor-default disabled:bg-transparent disabled:border-faded disabled:text-faded ${FOCUS_ON_PAPER}`;

export const DIVIDER = "my-4 border-0 border-t-2 border-dashed border-thermal";

/**
 * The slip's paper. On a phone it is a sheet docked to the bottom of the screen; a finished
 * receipt there keeps a plain edge.
 */
export const SHEET =
  "print-sheet relative rounded-sheet px-6 pt-7 pb-[22px] max-[720px]:table-sheet max-[720px]:px-4 max-[720px]:pt-0 max-[720px]:pb-[calc(12px+env(safe-area-inset-bottom))]";

/** What a closed phone sheet hides: everything but its summary line and its action. */
export const SHEET_FULL = "max-[720px]:group-data-closed/sheet:hidden";

/** The phone sheet's plain edges and padding, for a torn receipt. */
export const SHEET_PHONE =
  "max-[720px]:table-sheet max-[720px]:[mask:none] max-[720px]:px-4 max-[720px]:pt-0 max-[720px]:pb-[calc(12px+env(safe-area-inset-bottom))]";
