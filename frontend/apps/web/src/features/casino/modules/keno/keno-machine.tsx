import * as React from "react";
import { motion, type Transition } from "framer-motion";

/**
 * KenoDrawMachine — a glass draw sphere seated in a console, feeding a tray of
 * numbered balls. Modern crypto-betting styling: layered glass material, a rim
 * light, and a brand-coloured energy glow while a draw is live.
 *
 * While `agitated` (VRF pending or reveal running) the loose balls tumble and
 * the sphere lights up. `reduced` seats every motion instantly for
 * `prefers-reduced-motion`.
 */

const GLOBE = 128;
const WALL = 9; // glass housing thickness
const RACK_SLOTS = 5;
const RACK_BALL = 40;
const BALL_SCALE = GLOBE / 132; // jitter waypoints below are authored for 132

// Loose balls inside the sphere — fixed jitter waypoints so the tumble is
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
    ? { x: ball.jitter.map((p) => p.x * BALL_SCALE), y: ball.jitter.map((p) => p.y * BALL_SCALE) }
    : { x: ball.rest.x * BALL_SCALE, y: ball.rest.y * BALL_SCALE };
  const transition: Transition = active
    ? { duration: ball.dur, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
    : { type: "spring", stiffness: 120, damping: 14 };
  const size = Math.round(20 * BALL_SCALE);

  return (
    <motion.span
      className="absolute left-1/2 top-1/2 rounded-full"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        background:
          "radial-gradient(circle at 32% 28%, white, hsl(var(--brand)) 70%, hsl(var(--brand-active)) 100%)",
        boxShadow:
          "0 2px 5px hsl(var(--surface-0) / 0.5), inset 0 -2px 3px hsl(var(--brand-active))"
      }}
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
      className="relative flex shrink-0 items-center justify-center rounded-full font-mono font-bold"
      style={{
        width: RACK_BALL,
        height: RACK_BALL,
        fontSize: 15,
        color: hit ? "hsl(var(--fg-inverse))" : "hsl(var(--fg))",
        background: hit
          ? "radial-gradient(circle at 34% 26%, hsl(var(--fg) / 0.4), transparent 56%), hsl(var(--success))"
          : "radial-gradient(circle at 36% 28%, hsl(var(--surface-3)), hsl(var(--surface-1)))",
        boxShadow: hit
          ? "0 0 0 1px hsl(var(--success) / 0.6), 0 5px 16px hsl(var(--success) / 0.45)"
          : "0 3px 9px hsl(var(--surface-0) / 0.55), inset 0 2px 3px hsl(var(--fg) / 0.12)"
      }}
      initial={animateEntry ? { y: -58, opacity: 0, scale: 0.6 } : false}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={
        animateEntry ? { type: "spring", stiffness: 240, damping: 18, mass: 0.7 } : { duration: 0 }
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
  /** Globe balls tumble and the sphere lights up (VRF pending or reveal). */
  agitated: boolean;
  /** Newly seated tray balls drop in from the chute. */
  animateEntry: boolean;
  reduced: boolean;
}) {
  const live = agitated && !reduced;

  return (
    <div className="flex items-center justify-center gap-5">
      {/* Draw sphere */}
      <div className="relative shrink-0" style={{ width: GLOBE, height: GLOBE }} aria-hidden>
        {/* energy bloom while drawing */}
        <div
          className="pointer-events-none absolute -inset-3 rounded-full transition-opacity duration-500"
          style={{
            opacity: live ? 1 : 0,
            background: "radial-gradient(circle, hsl(var(--brand) / 0.5), transparent 66%)"
          }}
        />
        {/* metal housing */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(158deg, hsl(var(--surface-3)), hsl(var(--surface-0)) 68%)",
            boxShadow: "0 10px 28px hsl(var(--surface-0) / 0.55)"
          }}
        />
        {/* glass cavity */}
        <div
          className="absolute overflow-hidden rounded-full"
          style={{
            inset: WALL,
            background:
              "radial-gradient(circle at 38% 26%, hsl(var(--surface-2)), hsl(var(--surface-0)) 80%)",
            boxShadow:
              "inset 0 8px 20px hsl(var(--surface-0) / 0.6), inset 0 -3px 8px hsl(var(--fg) / 0.05)"
          }}
        >
          {GLOBE_BALLS.map((ball, i) => (
            <GlobeBall key={i} ball={ball} agitated={agitated} reduced={reduced} />
          ))}
        </div>
        {/* rim light */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow:
              "inset 0 3px 4px hsl(var(--fg) / 0.22), inset 0 -10px 18px hsl(var(--surface-0) / 0.55)"
          }}
        />
        {/* specular highlight */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            inset: WALL,
            background:
              "radial-gradient(46% 34% at 32% 22%, hsl(var(--fg) / 0.34), transparent 70%)"
          }}
        />
        {/* chute toward the tray */}
        <div
          className="absolute right-0 top-1/2 h-4 w-5 -translate-y-1/2 translate-x-[55%] rounded-r-md"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-3)), hsl(var(--surface-1)))"
          }}
        />
      </div>

      {/* Drawn-ball tray */}
      <div
        className="flex items-center gap-2 rounded-full p-2"
        style={{
          background: "hsl(var(--surface-0))",
          boxShadow: "inset 0 2px 8px hsl(var(--surface-0) / 0.55)"
        }}
      >
        {Array.from({ length: RACK_SLOTS }).map((_, index) => {
          const num = drawn[index];
          if (num == null) {
            return (
              <span
                key={index}
                className="shrink-0 rounded-full"
                style={{
                  width: RACK_BALL,
                  height: RACK_BALL,
                  background: "hsl(var(--surface-1))",
                  boxShadow: "inset 0 2px 6px hsl(var(--surface-0) / 0.6)"
                }}
                aria-hidden
              />
            );
          }
          return (
            <RackBall
              key={index}
              num={num}
              hit={spots.includes(num)}
              animateEntry={animateEntry && index === drawn.length - 1 && !reduced}
            />
          );
        })}
      </div>
    </div>
  );
}
