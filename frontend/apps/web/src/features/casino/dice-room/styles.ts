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
