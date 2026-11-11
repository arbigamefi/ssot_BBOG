"use client";

import * as React from "react";

import { SlotGlyph } from "./slots-copy";
import {
  BLUR_FAST,
  BLUR_SOFT,
  CELLS,
  CELL_OFFSET,
  lineCell,
  mod,
  START,
  STRIPS,
  stripIndex,
  SYMBOL_COUNT,
  type ReelMotion
} from "./reel-motion";

/**
 * Draws each reel where the motion has it: its strip moves by the cell on the line, blurred
 * vertically while it turns fast.
 */
export function drawReels(
  strips: ReadonlyArray<HTMLDivElement | null>,
  motion: ReelMotion,
  blurId: string
) {
  motion.reels.forEach((reel, i) => {
    const strip = strips[i];
    if (!strip) return;
    strip.style.setProperty("--m", lineCell(reel.c).toFixed(4));
    const blur = reel.v > BLUR_FAST ? "fast" : reel.v > BLUR_SOFT ? "soft" : null;
    strip.style.filter = blur ? `url(#${blurId}-${blur})` : "";
  });
}

/**
 * The machine set into the felt: a recessed window with three ivory drums and a pay line. The
 * drums that make a win light up. Static: the table moves the strips each frame.
 */
export const SlotsMachine = React.memo(function SlotsMachine({
  stripRefs,
  lit,
  blurId
}: {
  stripRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  /** The reels that make the win shown. */
  lit: readonly number[];
  blurId: string;
}) {
  return (
    <div aria-hidden="true" className="table-machine w-full">
      <svg width="0" height="0" className="absolute" focusable="false">
        <defs>
          <filter id={`${blurId}-fast`} x="0" y="-20%" width="100%" height="140%">
            <feGaussianBlur stdDeviation="0 7" />
          </filter>
          <filter id={`${blurId}-soft`} x="0" y="-20%" width="100%" height="140%">
            <feGaussianBlur stdDeviation="0 3" />
          </filter>
        </defs>
      </svg>
      <div className="relative grid grid-cols-3 gap-2 @max-[460px]/felt:gap-1.5">
        {STRIPS.map((strip, i) => (
          <div key={i} data-lit={lit.includes(i) || undefined} className="table-reel">
            <div
              ref={(el) => {
                stripRefs.current[i] = el;
              }}
              data-strip=""
              style={{ "--m": lineCell(stripIndex(i, START[i]!)) } as React.CSSProperties}
            >
              {Array.from({ length: CELLS }, (_, j) => (
                <div key={j} data-cell="">
                  <SlotGlyph s={strip[mod(j - CELL_OFFSET, SYMBOL_COUNT)]!} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="table-payline">
          <i />
          <i />
        </div>
      </div>
    </div>
  );
});
