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
 *
 * `variant` drives stage prominence: "idle" is the compact globe shown while
 * the player is still picking numbers (the 15-cell board is the protagonist);
 * "active" is the enlarged hero shown once a draw is live or its result is on
 * screen (the machine becomes the protagonist).
 */

const RACK_SLOTS = 5;
// Jitter waypoints below are authored against this globe diameter; every other
// size is derived by scaling against it so the tumble stays proportional.
const REFERENCE_GLOBE = 132;

export type KenoMachineVariant = "idle" | "active";

const VARIANT: Record<KenoMachineVariant, { globe: number; rackBall: number; gap: string }> = {
  idle: { globe: 116, rackBall: 36, gap: "gap-4" },
  // active rack fits all 5 balls within the panel without a horizontal scrollbar.
  active: { globe: 200, rackBall: 46, gap: "gap-6" }
};

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
  reduced,
  scale
}: {
  ball: (typeof GLOBE_BALLS)[number];
  agitated: boolean;
  reduced: boolean;
  scale: number;
}) {
  const active = agitated && !reduced;
  const animate = active
    ? { x: ball.jitter.map((p) => p.x * scale), y: ball.jitter.map((p) => p.y * scale) }
    : { x: ball.rest.x * scale, y: ball.rest.y * scale };
  const transition: Transition = active
    ? { duration: ball.dur, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
    : { type: "spring", stiffness: 120, damping: 14 };
  const size = Math.round(18 * scale);

  return (
    <motion.span
      className="absolute left-1/2 top-1/2 rounded-full bg-[radial-gradient(circle_at_34%_30%,#fff,hsl(var(--brand))_78%)] shadow-e1"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={false}
      animate={animate}
      transition={transition}
    />
  );
}

function RackBall({
  num,
  hit,
  animateEntry,
  size
}: {
  num: number;
  hit: boolean;
  animateEntry: boolean;
  size: number;
}) {
  return (
    <motion.span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border font-mono font-semibold shadow-e1",
        hit
          ? "border-success bg-success text-fg-inverse"
          : "border-border-strong bg-[radial-gradient(circle_at_36%_28%,hsl(var(--surface-3)),hsl(var(--surface-1)))] text-fg"
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.32)) }}
      initial={animateEntry ? { y: -(size * 1.15), opacity: 0, scale: 0.7 } : false}
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
  reduced,
  variant = "active"
}: {
  drawn: readonly number[];
  spots: readonly number[];
  /** Globe balls jostle (VRF pending or reveal running). */
  agitated: boolean;
  /** Newly seated rack balls drop in from the chute. */
  animateEntry: boolean;
  reduced: boolean;
  /** Stage prominence — see file header. */
  variant?: KenoMachineVariant;
}) {
  const { globe, rackBall, gap } = VARIANT[variant];
  const scale = globe / REFERENCE_GLOBE;
  const wall = Math.round(globe * 0.066);
  const chuteH = Math.round(11 * scale);
  const chuteW = Math.round(22 * scale);

  return (
    <div className={cn("flex shrink-0 items-center", gap)}>
      {/* Glass blower globe */}
      <div
        className="relative shrink-0 transition-[width,height] duration-300"
        style={{ width: globe, height: globe }}
        aria-hidden
      >
        <div className="absolute inset-0 rounded-full border-4 border-border-strong bg-[radial-gradient(circle_at_38%_30%,hsl(var(--surface-2)),hsl(var(--surface-0)))] shadow-e3" />
        <div
          className="absolute overflow-hidden rounded-full border border-border-soft bg-surface-0/70 shadow-inner-e1"
          style={{ inset: wall }}
        >
          {GLOBE_BALLS.map((ball, i) => (
            <GlobeBall key={i} ball={ball} agitated={agitated} reduced={reduced} scale={scale} />
          ))}
        </div>
        {/* Glass highlight */}
        <div
          className="pointer-events-none absolute rounded-full bg-[linear-gradient(145deg,hsl(var(--fg)/0.22),transparent_46%)]"
          style={{ inset: wall }}
        />
        {/* Chute toward the rack */}
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-r-md border border-l-0 border-border-strong bg-surface-2 shadow-e1"
          style={{ width: chuteW, height: chuteH, right: -chuteW / 2 }}
        />
      </div>

      {/* Drawn-ball rack — only while a draw is live or its result is up.
          During picking there are no draws, so the rack would just be ten
          empty slots taking the player's eye away from the number board. */}
      {variant === "active" && (
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          {Array.from({ length: RACK_SLOTS }).map((_, index) => {
            const num = drawn[index];
            const isLatest = index === drawn.length - 1;
            if (num == null) {
              return (
                <span
                  key={index}
                  className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-border-soft bg-surface-0"
                  style={{ width: rackBall, height: rackBall }}
                >
                  <span
                    className="rounded-full bg-fg-subtle/35"
                    style={{
                      width: Math.round(rackBall * 0.24),
                      height: Math.round(rackBall * 0.24)
                    }}
                    aria-hidden
                  />
                </span>
              );
            }
            return (
              <RackBall
                key={index}
                num={num}
                hit={spots.includes(num)}
                animateEntry={animateEntry && isLatest && !reduced}
                size={rackBall}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
