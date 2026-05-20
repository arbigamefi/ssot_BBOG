import * as React from "react";
import { motion, type Transition } from "framer-motion";

import { SLOT_SYMBOLS, SlotSymbolArt } from "./slot-symbol";

/**
 * SlotReel — one vertical reel.
 *
 * Replaces the previous discrete 90ms symbol swap (which read as a slideshow)
 * with a real reel: a tall symbol strip translated by framer-motion.
 *   - spinning → continuous linear scroll, one symbol set per loop;
 *   - stopped  → spring-decelerate so the result symbol lands on the payline
 *     with a short "thunk" overshoot.
 *
 * The reel window deliberately shows clipped neighbours above and below the
 * centre symbol, so it reads as a physical reel rather than a single tile.
 */

export const REEL_CELL = 96;
export const REEL_WINDOW = 232; // ~2.4 cells: one centred, two clipped
const REEL_LOOPS = 4;
const SYMBOL_COUNT = SLOT_SYMBOLS.length;
const SET_HEIGHT = SYMBOL_COUNT * REEL_CELL;
// y that centres the result symbol of copy #1 on the payline.
const BASE_Y = REEL_WINDOW / 2 - (SYMBOL_COUNT * REEL_CELL + REEL_CELL / 2);

export type SlotReelMode = "idle" | "spinning" | "stopped";

function finalY(resultSymbol: number) {
  return BASE_Y - resultSymbol * REEL_CELL;
}

export function SlotReel({
  mode,
  resultSymbol,
  symbolLabel,
  reduced,
  spinDurationMs = 420,
  spinningLabel
}: {
  mode: SlotReelMode;
  /** Result symbol index; required to land correctly when stopped. */
  resultSymbol: number;
  /** i18n label resolver for symbol accessibility. */
  symbolLabel: (symbol: number) => string;
  spinningLabel: string;
  reduced: boolean;
  spinDurationMs?: number;
}) {
  const spinning = mode === "spinning" && !reduced;
  const accessibleLabel = mode === "stopped" ? symbolLabel(resultSymbol) : spinningLabel;

  const animate = spinning ? { y: [BASE_Y, BASE_Y - SET_HEIGHT] } : { y: finalY(resultSymbol) };

  const transition: Transition = spinning
    ? { y: { duration: spinDurationMs / 1000, ease: "linear", repeat: Infinity } }
    : reduced || mode === "idle"
      ? { duration: 0 }
      : { y: { type: "spring", stiffness: 64, damping: 13, mass: 0.85 } };

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border-soft bg-gradient-to-b from-surface-2 to-surface-1"
      role="img"
      aria-label={accessibleLabel}
      style={{ height: REEL_WINDOW }}
    >
      <motion.div
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={false}
        animate={animate}
        transition={transition}
        style={{ willChange: "transform" }}
      >
        {Array.from({ length: REEL_LOOPS * SYMBOL_COUNT }).map((_, i) => {
          const symbol = i % SYMBOL_COUNT;
          return (
            <div
              key={i}
              className="flex shrink-0 items-center justify-center"
              style={{ height: REEL_CELL }}
            >
              <SlotSymbolArt value={symbol} size="lg" label={symbolLabel(symbol)} decorative />
            </div>
          );
        })}
      </motion.div>

      {/* Motion blur veil while the reel is spinning. */}
      {spinning ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-0/35 via-transparent to-surface-0/35"
        />
      ) : null}
    </div>
  );
}
