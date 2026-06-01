import * as React from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@ssot/ui";

import { EUROPEAN_WHEEL_ORDER, RED_NUMBER_SET } from "../../room/model";

/**
 * RouletteWheel — a real roulette bowl, not a flat dial.
 *
 * Stage realism: the wheel is a tilted bowl — an outer apron with a ball
 * track, a rotating wheel head with coloured pockets and metal frets, a raised
 * central cone with a spindle ornament, and a fixed pointer diamond.
 *
 * Animation realism: the wheel head and the ball orbit in opposite directions
 * (as a croupier spins them), then both decelerate; the ball drops off the
 * track, bounces over the frets and settles into the result pocket, which the
 * wheel head has brought under the pointer.
 *
 * `prefers-reduced-motion` snaps straight to the resolved position.
 */

const WHEEL = 320;
const SEG = 360 / 37;
const BALL_DROP = 36; // px the ball falls from the track into the pocket ring

export type RouletteWheelMode = "idle" | "spinning" | "settling" | "settled";

function pocketColor(num: number) {
  if (num === 0) return "hsl(var(--success))";
  return RED_NUMBER_SET.has(num) ? "hsl(var(--danger))" : "hsl(var(--surface-0))";
}

const CONIC = `conic-gradient(from ${-SEG / 2}deg, ${EUROPEAN_WHEEL_ORDER.map(
  (num, i) => `${pocketColor(num)} ${i * SEG}deg ${(i + 1) * SEG}deg`
).join(", ")})`;

export function RouletteWheel({
  mode,
  resultNum,
  reduced
}: {
  mode: RouletteWheelMode;
  resultNum: number | null;
  reduced: boolean;
}) {
  const resultIndex = resultNum == null ? -1 : EUROPEAN_WHEEL_ORDER.indexOf(resultNum);
  // CW rotation that brings the result pocket under the top pointer.
  const restNorm = resultIndex >= 0 ? (((-resultIndex * SEG) % 360) + 360) % 360 : 0;
  const settled = mode === "settled" || (mode === "settling" && reduced);
  const spinning = mode === "spinning" && !reduced;
  const settling = mode === "settling" && !reduced;

  // ---- Wheel head ----
  const wheelAnimate = spinning
    ? { rotate: [0, 360] }
    : settling || settled
      ? { rotate: 360 * 5 + restNorm }
      : { rotate: 0 };
  const wheelTransition: Transition = spinning
    ? { rotate: { duration: 7.5, ease: "linear", repeat: Infinity } }
    : settling
      ? { rotate: { duration: 2.3, ease: [0.1, 0.72, 0.12, 1] } }
      : { duration: 0 };

  // ---- Ball orbit ring (counter-rotates) ----
  const ballRingAnimate = spinning
    ? { rotate: [0, -360] }
    : settling || settled
      ? { rotate: -360 * 6 }
      : { rotate: 0 };
  const ballRingTransition: Transition = spinning
    ? { rotate: { duration: 2.4, ease: "linear", repeat: Infinity } }
    : settling
      ? { rotate: { duration: 2.0, ease: [0.12, 0.68, 0.12, 1] } }
      : { duration: 0 };

  // ---- Ball drop (track → pocket) ----
  const ballOnTrack = spinning;
  const ballAnimate = ballOnTrack
    ? { y: 0, scale: 1.05 }
    : settling
      ? { y: [0, BALL_DROP * 0.52, BALL_DROP * 0.78, BALL_DROP * 0.62, BALL_DROP], scale: 1 }
      : { y: BALL_DROP, scale: 1 };
  const ballTransition: Transition = ballOnTrack
    ? { duration: 0.4, ease: "easeOut" }
    : settling
      ? { duration: 1.5, delay: 0.55, ease: "easeOut", times: [0, 0.45, 0.68, 0.85, 1] }
      : { duration: 0 };

  return (
    <div
      className="relative shrink-0"
      style={{ width: WHEEL, height: WHEEL, perspective: 1100 }}
      aria-hidden
    >
      {/* Drop shadow on the table */}
      <div className="pointer-events-none absolute left-1/2 -bottom-3 h-7 w-3/4 -translate-x-1/2 rounded-full bg-surface-0/55 blur-2xl" />

      {/* Tilted bowl assembly */}
      <div
        className="absolute inset-0"
        style={{ transform: "rotateX(22deg)", transformStyle: "preserve-3d" }}
      >
        {/* Outer rim / bowl frame */}
        <div
          className="absolute inset-0 rounded-full shadow-e3"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, hsl(var(--surface-3)), hsl(var(--surface-0)) 72%)"
          }}
        />
        {/* Ball track (apron) */}
        <div
          className="absolute inset-[18px] rounded-full border border-border-strong shadow-inner-e1"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, hsl(var(--surface-2)), hsl(var(--surface-0)))"
          }}
        />
        <div className="absolute inset-[30px] rounded-full border border-border-soft" />

        {/* Wheel head */}
        <motion.div
          className="absolute inset-[40px] rounded-full border border-border-strong shadow-e2"
          style={{ background: CONIC }}
          initial={false}
          animate={wheelAnimate}
          transition={wheelTransition}
        >
          {/* Frets — metal separators between pockets */}
          {EUROPEAN_WHEEL_ORDER.map((num, i) => (
            <div
              key={`fret-${num}`}
              className="absolute inset-0 flex justify-center"
              style={{ transform: `rotate(${i * SEG + SEG / 2}deg)` }}
            >
              <span className="h-[26px] w-[2px] bg-gradient-to-b from-fg/70 via-fg-subtle/40 to-transparent" />
            </div>
          ))}

          {/* Pocket numbers */}
          {EUROPEAN_WHEEL_ORDER.map((num, i) => (
            <div
              key={num}
              className="absolute inset-0 flex justify-center"
              style={{ transform: `rotate(${i * SEG}deg)` }}
            >
              <span
                className={cn(
                  "mt-1 font-mono text-[10px] font-semibold leading-none",
                  num === 0 ? "text-fg-inverse" : "text-fg"
                )}
              >
                {num}
              </span>
            </div>
          ))}

          {/* Pocket inner ring */}
          <div className="absolute inset-[34px] rounded-full border-2 border-border-strong bg-surface-0/70 shadow-inner-e1" />

          {/* Central cone / turret */}
          <div
            className="absolute inset-[58px] rounded-full shadow-e3"
            style={{
              background:
                "radial-gradient(circle at 38% 32%, hsl(var(--accent)), hsl(var(--brand)) 62%, hsl(var(--surface-2)))"
            }}
          >
            <div
              className="absolute inset-[26%] rounded-full shadow-inner-e1"
              style={{
                background:
                  "radial-gradient(circle at 40% 35%, hsl(var(--surface-2)), hsl(var(--surface-0)))"
              }}
            />
            {/* Turret arms. Keep horizontal/vertical bars independently centered
                instead of rotating a translated span; transform order can shift
                the vertical arm off the spindle center. */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2">
              <span className="absolute left-1/2 top-1/2 h-[3px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-fg/45 to-transparent" />
              <span className="absolute left-1/2 top-1/2 h-full w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-transparent via-fg/45 to-transparent" />
            </div>
            <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-gradient-to-br from-fg via-fg-muted to-fg-subtle shadow-e1" />
          </div>
        </motion.div>

        {/* Ball orbit ring — counter-rotates */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={ballRingAnimate}
          transition={ballRingTransition}
        >
          <motion.div
            className="absolute left-1/2 top-[20px] h-[14px] w-[14px] rounded-full shadow-e2"
            style={{
              marginLeft: -7,
              background:
                "radial-gradient(circle at 35% 30%, white, hsl(var(--fg-muted)) 75%, hsl(var(--fg-subtle)))"
            }}
            initial={false}
            animate={ballAnimate}
            transition={ballTransition}
          />
        </motion.div>

        {/* Glass sheen */}
        <div
          className="pointer-events-none absolute inset-[18px] rounded-full"
          style={{ background: "linear-gradient(150deg, hsl(var(--fg) / 0.16), transparent 45%)" }}
        />
      </div>

      {/* Fixed pointer diamond */}
      <div className="absolute left-1/2 top-[6px] h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm bg-accent shadow-glow" />
    </div>
  );
}
