import * as React from "react";

/** Which of a face's nine cells hold a pip, read left to right, top to bottom. */
const PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

/** The cube's faces, each turned to its side; opposite faces add up to seven. */
const SIDES = [1, 6, 3, 4, 2, 5] as const;

function Pips({ n }: { n: number }) {
  const on = PIPS[n] ?? [];
  return (
    <>
      {Array.from({ length: 9 }, (_, k) => (
        <i key={k} data-pip={on.includes(k) || undefined} />
      ))}
    </>
  );
}

/**
 * A die on the dish: an ivory cube of six faces, navy pips with the one and the four lacquer red,
 * as at a sic bo table. The room turns it with a transform on the outer element.
 */
export const DieCube = React.forwardRef<HTMLSpanElement>(function DieCube(_, ref) {
  return (
    <span ref={ref} data-c="die">
      <span data-c="core" />
      {SIDES.map((n) => (
        <span key={n} data-f={n}>
          <Pips n={n} />
        </span>
      ))}
    </span>
  );
});

/** A die printed flat: on the layout, the last results, the status line and the receipt. */
export function MiniDie({ n, className }: { n: number; className?: string }) {
  return (
    <span aria-hidden="true" data-n={n} className={`sicbo-die ${className ?? ""}`}>
      <Pips n={n} />
    </span>
  );
}
