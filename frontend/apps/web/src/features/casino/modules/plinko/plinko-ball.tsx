import * as React from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { cn } from "@ssot/ui";

/**
 * PlinkoBall — the falling disc.
 *
 * The board, peg grid and bucket landing are owned by the stage; this
 * component owns only how the ball *moves*. The previous ball glided
 * point-to-point with a linear CSS `transition`, which read as a chess piece
 * teleporting between cells. Here the descent is driven by framer-motion:
 *
 *   - vertical drop uses a spring, so the ball overshoots and settles at each
 *     peg row — the signature plinko "bonk";
 *   - the ball accumulates rotation in the direction of travel, so it reads as
 *     rolling rather than sliding;
 *   - a short scaleY squash fires on each peg contact;
 *   - the bucket landing adds a settle bounce.
 *
 * `prefers-reduced-motion` collapses all of it to a direct position set.
 */

export type PlinkoBallMode = "idle" | "pending" | "dropping" | "landed";

export function PlinkoBall({
  mode,
  point,
  rotation,
  durationMs,
  label
}: {
  mode: PlinkoBallMode;
  /** Board-space position in percent of the play area. */
  point: { x: number; y: number };
  /** Accumulated rotation in degrees (sign follows travel direction). */
  rotation: number;
  /** Duration of the current drop step in ms. */
  durationMs: number;
  label: React.ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;

  // Outer node carries position. marginLeft/Top centre the ball without
  // consuming `transform`, leaving the inner node free for rotate / squash.
  const positionTransition: Transition = reduced
    ? { duration: 0 }
    : mode === "dropping"
      ? {
          left: { duration: durationMs / 1000, ease: "easeIn" },
          top: { type: "spring", stiffness: 520, damping: 21, mass: 0.9 }
        }
      : mode === "landed"
        ? { type: "spring", stiffness: 320, damping: 18 }
        : { duration: 0.36, ease: "easeOut" };

  // Inner node: rotation + squash + idle bob.
  const innerAnimate =
    mode === "pending" && !reduced
      ? { rotate: rotation, y: [0, -7, 0], scaleY: 1 }
      : mode === "dropping" && !reduced
        ? { rotate: rotation, y: 0, scaleY: [1, 0.82, 1] }
        : mode === "landed" && !reduced
          ? { rotate: rotation, y: 0, scaleY: [1, 1.16, 0.94, 1] }
          : { rotate: rotation, y: 0, scaleY: 1 };

  const innerTransition: Transition = reduced
    ? { duration: 0 }
    : mode === "pending"
      ? { y: { repeat: Infinity, duration: 1.3, ease: "easeInOut" }, rotate: { duration: 0.4 } }
      : mode === "dropping"
        ? {
            scaleY: { duration: Math.min(0.34, durationMs / 1000) },
            rotate: { duration: durationMs / 1000, ease: "linear" }
          }
        : mode === "landed"
          ? { scaleY: { duration: 0.42 }, rotate: { duration: 0.3 } }
          : { duration: 0.3 };

  const won = mode === "landed";

  return (
    <motion.div
      className="absolute z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 sm:h-8 sm:w-8"
      animate={{ left: `${point.x}%`, top: `${point.y}%` }}
      transition={positionTransition}
    >
      <motion.div
        className="relative h-full w-full"
        animate={innerAnimate}
        transition={innerTransition}
      >
        {/* Sphere body — radial highlight so it reads as a 3D ball. */}
        <div
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full ring-2",
            won ? "ring-accent" : "ring-brand/50"
          )}
          style={{
            background:
              "radial-gradient(circle at 34% 30%, hsl(var(--accent)) 0%, hsl(var(--brand)) 58%, hsl(var(--brand-active)) 100%)",
            boxShadow:
              "0 6px 14px hsl(var(--surface-0) / 0.7), inset 0 2px 4px hsl(var(--fg) / 0.35)"
          }}
        >
          <span className="font-mono text-[10px] font-semibold text-fg-inverse sm:text-sm">
            {label}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
