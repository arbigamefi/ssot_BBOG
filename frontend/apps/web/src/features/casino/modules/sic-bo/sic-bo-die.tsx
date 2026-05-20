import * as React from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@ssot/ui";

/**
 * SicBoDie — a real six-sided 3D pip die.
 *
 * Replaces the previous 2D pip-grid face. The cube has six pip faces with
 * opposite faces summing to seven; it tumbles on three axes while rolling and
 * spring-settles so the result face turns forward.
 *
 * `prefers-reduced-motion` snaps straight to the result face.
 */

const SIZE = 84;
const HALF = SIZE / 2;

export type SicBoDieMode = "idle" | "rolling" | "settled";

// [row, col] pip coordinates on a 3x3 grid.
const DIE_PIPS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [
    [0, 2],
    [2, 0]
  ],
  3: [
    [0, 2],
    [1, 1],
    [2, 0]
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
    [1, 0],
    [2, 0],
    [0, 2],
    [1, 2],
    [2, 2]
  ]
};

// Cube faces — opposite faces sum to 7.
const FACES: Array<{ value: number; transform: string }> = [
  { value: 1, transform: `translateZ(${HALF}px)` },
  { value: 6, transform: `rotateY(180deg) translateZ(${HALF}px)` },
  { value: 3, transform: `rotateY(90deg) translateZ(${HALF}px)` },
  { value: 4, transform: `rotateY(-90deg) translateZ(${HALF}px)` },
  { value: 2, transform: `rotateX(90deg) translateZ(${HALF}px)` },
  { value: 5, transform: `rotateX(-90deg) translateZ(${HALF}px)` }
];

// Cube rotation that brings each value's face forward.
const FACE_ROTATION: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: -90, ry: 0 },
  3: { rx: 0, ry: -90 },
  4: { rx: 0, ry: 90 },
  5: { rx: 90, ry: 0 },
  6: { rx: 0, ry: 180 }
};

function PipFace({ value, won }: { value: number; won: boolean }) {
  const lit = DIE_PIPS[value] ?? [];
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-2.5">
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const on = lit.some(([pr, pc]) => pr === r && pc === c);
        return (
          <span key={i} className="flex items-center justify-center">
            {on ? (
              <span
                className={cn("h-2.5 w-2.5 rounded-full shadow-e1", won ? "bg-accent" : "bg-fg")}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function SicBoDie({
  value,
  mode,
  seed = 0,
  won = false,
  reduced = false
}: {
  /** Result die value 1-6. */
  value: number;
  mode: SicBoDieMode;
  /** Die index, used to desync the tumble between the three dice. */
  seed?: number;
  won?: boolean;
  reduced?: boolean;
}) {
  const face = FACE_ROTATION[value] ?? { rx: 0, ry: 0 };

  const animate =
    mode === "rolling" && !reduced
      ? {
          rotateX: [face.rx, face.rx + 360],
          rotateY: [face.ry, face.ry + 360],
          rotateZ: [0, 360]
        }
      : mode === "settled" || reduced
        ? { rotateX: 720 + face.rx, rotateY: 720 + face.ry, rotateZ: 0 }
        : { rotateX: face.rx - 16, rotateY: face.ry + 20, rotateZ: 0 };

  const transition: Transition =
    mode === "rolling" && !reduced
      ? { duration: 0.66 + seed * 0.12, ease: "linear", repeat: Infinity }
      : mode === "settled" && !reduced
        ? { type: "spring", stiffness: 68, damping: 13, mass: 0.85 }
        : { duration: reduced ? 0 : 0.4, ease: "easeOut" };

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE + 16, height: SIZE + 16, perspective: 760 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-1 h-3 w-16 rounded-[50%] bg-black/45 blur-md"
      />
      <motion.div
        className="relative"
        style={{ width: SIZE, height: SIZE, transformStyle: "preserve-3d" }}
        animate={animate}
        transition={transition}
        aria-label={`Die showing ${value}`}
      >
        {FACES.map((f) => (
          <div
            key={f.value}
            className={cn(
              "absolute rounded-md border border-border",
              won && mode === "settled"
                ? "bg-gradient-to-br from-accent-soft to-surface-1"
                : "bg-gradient-to-br from-surface-3 to-surface-1"
            )}
            style={{ width: SIZE, height: SIZE, transform: f.transform }}
          >
            <PipFace value={f.value} won={won && mode === "settled"} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
