import * as React from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@ssot/ui";

/**
 * KenoDrawMachine — a lottery air-blower, not a flat row of dots.
 *
 * Stage realism: a glass globe with loose balls jostling inside, a chute that
 * carries a drawn ball down to a numbered rack.
 *
 * Animation realism: while a draw is live the globe balls bounce; each drawn
 * number rides out of the chute and drops into the next rack slot with a small
 * settle bounce. `prefers-reduced-motion` seats every ball instantly.
 */

const GLOBE = 132;
const RACK_SLOTS = 10;

// Loose balls inside the globe — fixed jitter waypoints so the tumble is
// deterministic but unsynchronised between balls.
const GLOBE_BALLS = [
  {
    rest: { x: -22, y: 30 },
    jitter: [
      { x: -22, y: 30 },
      { x: -8, y: -18 },
      { x: 18, y: 8 },
      { x: -14, y: 24 }
    ],
    dur: 0.62
  },
  {
    rest: { x: 0, y: 34 },
    jitter: [
      { x: 0, y: 34 },
      { x: 16, y: -12 },
      { x: -18, y: 14 },
      { x: 6, y: 28 }
    ],
    dur: 0.74
  },
  {
    rest: { x: 22, y: 30 },
    jitter: [
      { x: 22, y: 30 },
      { x: -12, y: 6 },
      { x: 10, y: -20 },
      { x: 24, y: 22 }
    ],
    dur: 0.68
  },
  {
    rest: { x: -12, y: 20 },
    jitter: [
      { x: -12, y: 20 },
      { x: 20, y: 18 },
      { x: -6, y: -16 },
      { x: -20, y: 10 }
    ],
    dur: 0.81
  },
  {
    rest: { x: 12, y: 20 },
    jitter: [
      { x: 12, y: 20 },
      { x: -20, y: -8 },
      { x: 14, y: 24 },
      { x: 2, y: -14 }
    ],
    dur: 0.57
  },
  {
    rest: { x: -2, y: 12 },
    jitter: [
      { x: -2, y: 12 },
      { x: 10, y: 28 },
      { x: -16, y: -10 },
      { x: 18, y: 0 }
    ],
    dur: 0.7
  }
] as const;

function GlobeBall({
  ball,
  agitated,
  reduced
}: {
  ball: (typeof GLOBE_BALLS)[number];
  agitated: boolean;
  reduced: boolean;
}) {
  const active = agitated && !reduced;
  const animate = active
    ? { x: ball.jitter.map((p) => p.x), y: ball.jitter.map((p) => p.y) }
    : { x: ball.rest.x, y: ball.rest.y };
  const transition: Transition = active
    ? { duration: ball.dur, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
    : { type: "spring", stiffness: 120, damping: 14 };

  return (
    <motion.span
      className="absolute left-1/2 top-1/2 h-[18px] w-[18px] rounded-full bg-[radial-gradient(circle_at_34%_30%,#fff,hsl(var(--brand))_78%)] shadow-e1"
      style={{ marginLeft: -9, marginTop: -9 }}
      initial={false}
      animate={animate}
      transition={transition}
    />
  );
}

function RackBall({
  num,
  hit,
  animateEntry
}: {
  num: number;
  hit: boolean;
  animateEntry: boolean;
}) {
  return (
    <motion.span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold shadow-e1",
        hit
          ? "border-success bg-success text-fg-inverse"
          : "border-border-strong bg-[radial-gradient(circle_at_36%_28%,hsl(var(--surface-3)),hsl(var(--surface-1)))] text-fg"
      )}
      initial={animateEntry ? { y: -52, opacity: 0, scale: 0.7 } : false}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={
        animateEntry ? { type: "spring", stiffness: 240, damping: 17, mass: 0.7 } : { duration: 0 }
      }
    >
      {num}
    </motion.span>
  );
}

export function KenoDrawMachine({
  drawn,
  spots,
  agitated,
  animateEntry,
  reduced
}: {
  drawn: readonly number[];
  spots: readonly number[];
  /** Globe balls jostle (VRF pending or reveal running). */
  agitated: boolean;
  /** Newly seated rack balls drop in from the chute. */
  animateEntry: boolean;
  reduced: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      {/* Glass blower globe */}
      <div className="relative shrink-0" style={{ width: GLOBE, height: GLOBE }} aria-hidden>
        <div className="absolute inset-0 rounded-full border-4 border-border-strong bg-[radial-gradient(circle_at_38%_30%,hsl(var(--surface-2)),hsl(var(--surface-0)))] shadow-e3" />
        <div className="absolute inset-[10px] overflow-hidden rounded-full border border-border-soft bg-surface-0/70 shadow-inner-e1">
          {GLOBE_BALLS.map((ball, i) => (
            <GlobeBall key={i} ball={ball} agitated={agitated} reduced={reduced} />
          ))}
        </div>
        {/* Glass highlight */}
        <div className="pointer-events-none absolute inset-[10px] rounded-full bg-[linear-gradient(145deg,hsl(var(--fg)/0.22),transparent_46%)]" />
        {/* Chute toward the rack */}
        <div className="absolute -right-3 top-1/2 h-3 w-6 -translate-y-1/2 rounded-r-md border border-l-0 border-border-strong bg-surface-2 shadow-e1" />
      </div>

      {/* Drawn-ball rack */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
        {Array.from({ length: RACK_SLOTS }).map((_, index) => {
          const num = drawn[index];
          const isLatest = index === drawn.length - 1;
          if (num == null) {
            return (
              <span
                key={index}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border-soft bg-surface-0"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-fg-subtle/35" aria-hidden />
              </span>
            );
          }
          return (
            <RackBall
              key={index}
              num={num}
              hit={spots.includes(num)}
              animateEntry={animateEntry && isLatest && !reduced}
            />
          );
        })}
      </div>
    </div>
  );
}
