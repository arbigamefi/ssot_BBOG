import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@ssot/ui";

/**
 * BaccaratCard — a single card with a real deal-then-turn lifecycle.
 *
 * A baccarat round has two beats: cards are first dealt face-down out of the
 * shoe, then the croupier turns them. This component models both:
 *   - entrance: the card slides in from the shoe (up-and-right) face-down;
 *   - flip: when `faceUp` becomes true the card turns (rotateY 0 → 180).
 *
 * Driving the flip off the `faceUp` prop means a card placed face-down during
 * the VRF wait simply turns over later — no remount. `instant` mounts the card
 * face-up with no animation (a round that was already resolved on load).
 */

const CARD_SUITS = [
  {
    className: "text-fg",
    path: "M12 3c-2.9 3.1-6.4 5.4-6.4 9.1 0 2.5 1.7 4.2 4 4.2.9 0 1.7-.3 2.4-.8-.2 1.5-.8 2.9-1.8 4.2h3.6c-1-1.3-1.6-2.7-1.8-4.2.7.5 1.5.8 2.4.8 2.3 0 4-1.7 4-4.2C18.4 8.4 14.9 6.1 12 3Z"
  },
  {
    className: "text-danger",
    path: "M12 20s-7.2-4.4-7.2-10.1C4.8 6.9 6.7 5 9.2 5c1.2 0 2.3.6 2.8 1.5C12.5 5.6 13.6 5 14.8 5c2.5 0 4.4 1.9 4.4 4.9C19.2 15.6 12 20 12 20Z"
  },
  {
    className: "text-danger",
    path: "M12 3 19 12 12 21 5 12 12 3Z"
  },
  {
    className: "text-fg",
    path: "M9.1 10.8A3.2 3.2 0 1 1 12 8.9a3.2 3.2 0 1 1 2.9 1.9 3.2 3.2 0 1 1-3.3 4.8c-.1 1.5-.7 2.8-1.7 4.1h4.2c-1-1.3-1.6-2.6-1.7-4.1a3.2 3.2 0 1 1-3.3-4.8Z"
  }
] as const;

function CardSuitIcon({ suitIndex, className }: { suitIndex: number; className?: string }) {
  const suit = CARD_SUITS[suitIndex % CARD_SUITS.length] ?? CARD_SUITS[0];
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn("drop-shadow-sm", suit.className, className)}
      fill="currentColor"
    >
      <path d={suit.path} />
    </svg>
  );
}

export function EmptyCardSlot() {
  return (
    <div
      aria-hidden
      className="h-14 w-10 rounded-md border border-dashed border-border-soft bg-surface-0/40 sm:h-28 sm:w-20 sm:rounded-lg"
    />
  );
}

export function BaccaratCard({
  value,
  suitIndex,
  faceUp,
  instant = false,
  dealDelayMs = 0
}: {
  /** Card pip value; 0 renders as a ten. Undefined while still face-down. */
  value: number | undefined;
  suitIndex: number;
  /** Whether the card is turned face-up. */
  faceUp: boolean;
  /** Skip entrance + flip animation (already-resolved load). */
  instant?: boolean;
  /** Stagger applied to the entrance slide, so cards deal one at a time. */
  dealDelayMs?: number;
}) {
  const label = value == null ? "" : value === 0 ? "10" : String(value);

  return (
    <motion.div
      className="h-14 w-10 [perspective:900px] sm:h-28 sm:w-20"
      initial={instant ? false : { x: 34, y: -40, opacity: 0, rotate: 9 }}
      animate={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
      transition={
        instant
          ? { duration: 0 }
          : { delay: dealDelayMs / 1000, duration: 0.34, ease: [0.16, 1, 0.3, 1] }
      }
      aria-label={faceUp && value != null ? `Card value ${value}` : "Face-down card"}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={instant ? false : { rotateY: 0 }}
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={instant ? { duration: 0 } : { duration: 0.46, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {/* Back face */}
        <div className="absolute inset-0 flex items-center justify-center rounded-md border border-brand/30 bg-surface-2 shadow-e1 [backface-visibility:hidden] sm:rounded-lg">
          <span className="absolute inset-1.5 rounded border border-brand/25 bg-brand-soft sm:inset-2 sm:rounded-md" />
          <span className="absolute left-1.5 top-1.5 h-1 w-1 rounded-full bg-brand/60 sm:left-2.5 sm:top-2.5 sm:h-1.5 sm:w-1.5" />
          <span className="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-brand/60 sm:bottom-2.5 sm:right-2.5 sm:h-1.5 sm:w-1.5" />
          <span className="relative h-5 w-3.5 rounded border border-brand/35 bg-surface-0/50 sm:h-9 sm:w-6" />
        </div>

        {/* Front face */}
        <div className="absolute inset-0 flex items-center justify-center rounded-md border border-border bg-fg shadow-e2 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:rounded-lg">
          <span className="absolute left-1 top-0.5 font-mono text-[9px] font-semibold text-surface-0 sm:left-2 sm:top-1.5 sm:text-sm">
            {label}
          </span>
          <span className="absolute bottom-0.5 right-1 rotate-180 font-mono text-[9px] font-semibold text-surface-0 sm:bottom-1.5 sm:right-2 sm:text-sm">
            {label}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-0/10 sm:h-11 sm:w-11">
            <CardSuitIcon suitIndex={suitIndex} className="h-4 w-4 sm:h-7 sm:w-7" />
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
