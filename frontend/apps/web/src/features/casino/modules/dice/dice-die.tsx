import * as React from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { cn } from "@ssot/ui";

/**
 * DiceDie — the hero 3D die for the percentile-dice game.
 *
 * It is a real CSS-3D cube (six faces, `preserve-3d`). Because the game is a
 * d100, the front face shows the rolled NUMBER (1..100); the other five faces
 * carry pip patterns purely so the tumbling object reads as a die.
 *
 * Motion is driven by framer-motion (no CSS keyframe dependency):
 *   - idle      → static three-quarter tilt
 *   - rolling   → continuous tumble (VRF pending, result unknown)
 *   - revealing → spin that decelerates and lands front-face-forward
 *   - settled   → held front-face-forward, win/loss colour + one-shot flash
 *
 * `prefers-reduced-motion` collapses tumble/reveal to a static result.
 */

export type DiceDieMode = "idle" | "rolling" | "revealing" | "settled";

const SIZE = 152;
const HALF = SIZE / 2;

const FACE_TRANSFORM: Record<string, string> = {
  front: `translateZ(${HALF}px)`,
  back: `rotateY(180deg) translateZ(${HALF}px)`,
  right: `rotateY(90deg) translateZ(${HALF}px)`,
  left: `rotateY(-90deg) translateZ(${HALF}px)`,
  top: `rotateX(90deg) translateZ(${HALF}px)`,
  bottom: `rotateX(-90deg) translateZ(${HALF}px)`
};

// Pip layouts for the five decorative faces (3x3 grid coordinates).
const PIPS: Record<number, Array<[number, number]>> = {
  2: [
    [0, 0],
    [2, 2]
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2]
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2]
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2]
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2]
  ]
};

function PipFace({ count }: { count: number }) {
  const on = PIPS[count] ?? [];
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-1 p-6">
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const lit = on.some(([pr, pc]) => pr === r && pc === c);
        return (
          <span key={i} className="flex items-center justify-center">
            {lit ? <span className="h-3 w-3 rounded-full bg-fg/55" /> : null}
          </span>
        );
      })}
    </div>
  );
}

function tumbleTarget(mode: DiceDieMode): {
  rotateX: number | number[];
  rotateY: number | number[];
} {
  switch (mode) {
    case "rolling":
      // Continuous keyframe loop — a 360° span on both axes.
      return { rotateX: [-18, 342], rotateY: [24, 384] };
    case "revealing":
    case "settled":
      // Two full turns, landing front-face-forward (720 ≡ 0 mod 360).
      return { rotateX: 720, rotateY: 720 };
    case "idle":
    default:
      return { rotateX: -18, rotateY: 24 };
  }
}

function tumbleTransition(mode: DiceDieMode, reduced: boolean): Transition {
  if (reduced) return { duration: 0 };
  switch (mode) {
    case "rolling":
      return { duration: 0.78, ease: "linear", repeat: Infinity };
    case "revealing":
      return { duration: 1.25, ease: [0.16, 1, 0.3, 1] };
    case "settled":
      return { duration: 0 };
    case "idle":
    default:
      return { duration: 0.45, ease: "easeOut" };
  }
}

export function DiceDie({
  mode,
  faceValue,
  faceLabel,
  won
}: {
  mode: DiceDieMode;
  /** Number rendered on the front face (roll when known, target otherwise). */
  faceValue: number;
  /** Small caption above the number ("TARGET" / "ROLL"). */
  faceLabel: string;
  /** Win state — only meaningful once settled. */
  won: boolean | null;
}) {
  const reduced = useReducedMotion() ?? false;
  const isSettled = mode === "settled";

  const frontTone =
    isSettled && won === true
      ? "border-success bg-success-soft"
      : isSettled && won === false
        ? "border-danger bg-danger-soft"
        : "border-brand/60 bg-surface-2";

  const numberTone =
    isSettled && won === true
      ? "text-success"
      : isSettled && won === false
        ? "text-danger"
        : "text-fg";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE + 48, height: SIZE + 48, perspective: 1100 }}
    >
      {/* Contact shadow under the die. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-3 h-5 w-40 rounded-[50%] bg-black/45 blur-xl"
      />

      {/* One-shot win/loss flash ring on settle. */}
      {isSettled && won !== null ? (
        <motion.span
          aria-hidden
          key={won ? "win-flash" : "loss-flash"}
          initial={{ scale: 0.7, opacity: 0.55 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={cn(
            "pointer-events-none absolute h-40 w-40 rounded-full ring-2",
            won ? "ring-success" : "ring-danger"
          )}
        />
      ) : null}

      <motion.div
        role="img"
        aria-label={`Percentile die showing ${faceValue}`}
        className="relative"
        style={{ width: SIZE, height: SIZE, transformStyle: "preserve-3d" }}
        animate={tumbleTarget(mode)}
        transition={tumbleTransition(mode, reduced)}
      >
        {/* Front — the meaningful face. */}
        <div
          className={cn(
            "absolute flex flex-col items-center justify-center rounded-xl border-2 shadow-e2",
            frontTone
          )}
          style={{ width: SIZE, height: SIZE, transform: FACE_TRANSFORM.front }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
            {faceLabel}
          </span>
          <span className={cn("font-mono text-6xl font-semibold tabular-nums", numberTone)}>
            {faceValue}
          </span>
        </div>

        {/* Five decorative pip faces. */}
        {(
          [
            ["back", 6],
            ["right", 3],
            ["left", 4],
            ["top", 2],
            ["bottom", 5]
          ] as const
        ).map(([name, pips]) => (
          <div
            key={name}
            className="absolute rounded-xl border-2 border-border bg-surface-3"
            style={{ width: SIZE, height: SIZE, transform: FACE_TRANSFORM[name] }}
          >
            <PipFace count={pips} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
