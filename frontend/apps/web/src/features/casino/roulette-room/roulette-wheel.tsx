import * as React from "react";

import { pocketColour } from "./roulette-model";
import { pocketAngle, SEG, WHEEL_ORDER, type WheelMotion } from "./wheel-motion";

/** The wheel seen from a seat at the table: drawn squashed, not turned in 3D. */
const TILT = 0.78;

const rad = (a: number) => (a * Math.PI) / 180;
const pt = (r: number, a: number) =>
  `${(r * Math.sin(rad(a))).toFixed(2)} ${(-r * Math.cos(rad(a))).toFixed(2)}`;
const wedge = (r0: number, r1: number, a0: number, a1: number) =>
  `M${pt(r1, a0)} A${r1} ${r1} 0 0 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 0 0 ${pt(r0, a0)}Z`;

/** The box the tilted wheel takes, so nothing around it can overlap it. */
const VIEW_BOX = `-162 ${(-158 * TILT - 3).toFixed(2)} 324 ${(328 * TILT + 6).toFixed(2)}`;

const POCKETS = WHEEL_ORDER.map((n, i) => {
  const a0 = i * SEG - SEG / 2;
  return {
    n,
    colour: pocketColour(n),
    wall: wedge(100, 116, a0, a0 + SEG),
    floor: wedge(82, 100, a0, a0 + SEG),
    turn: (i * SEG).toFixed(3),
    fret: `M${pt(82, a0)} L${pt(116, a0)}`
  };
});
const DEFLECTORS = Array.from({ length: 8 }, (_, j) => {
  const a = j * 45 + 22.5;
  return `M${pt(126, a)} L${pt(121.5, a + 2.2)} L${pt(117, a)} L${pt(121.5, a - 2.2)}Z`;
});
const ARMS = Array.from({ length: 4 }, (_, j) => {
  const a = j * 90 + 45;
  return {
    d: `M${pt(12, a)} L${pt(42, a)}`,
    cx: (42 * Math.sin(rad(a))).toFixed(2),
    cy: (-42 * Math.cos(rad(a))).toFixed(2)
  };
});
const GLINT = `M${pt(155, -70)} A155 155 0 0 1 ${pt(155, 8)}`;

/** Turn the head and put the ball where the motion says. Called every frame while either moves. */
export function drawWheel(
  head: SVGGElement | null,
  ball: SVGGElement | null,
  motion: Pick<WheelMotion, "theta" | "psi" | "r">
) {
  head?.setAttribute("transform", `rotate(${motion.theta.toFixed(3)})`);
  const a = rad(motion.theta + motion.psi);
  ball?.setAttribute(
    "transform",
    `translate(${(motion.r * Math.sin(a)).toFixed(2)} ${(-motion.r * Math.cos(a) * TILT).toFixed(2)})`
  );
}

/**
 * The European single-zero wheel: an ivory ball track with eight deflectors, a turning head of 37
 * pockets in lacquer red and rail black with a green zero, and a cone with an ivory turret. The
 * ball is drawn round, outside the tilt. Once the ball is in, the winning pocket lights.
 */
export const RouletteWheel = React.memo(function RouletteWheel({
  headRef,
  ballRef,
  lit
}: {
  headRef: React.Ref<SVGGElement>;
  ballRef: React.Ref<SVGGElement>;
  /** The number whose pocket is lit, once the ball is in it. */
  lit: number | null;
}) {
  const id = React.useId().replace(/:/g, "");
  const url = (name: string) => `url(#${id}-${name})`;
  const litAt = lit == null ? null : pocketAngle(lit);
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" className="block size-full">
      <defs>
        <radialGradient id={`${id}-rim`} r="0.5">
          <stop offset="0.86" data-s="rail-lo" />
          <stop offset="0.93" data-s="rail-hi" />
          <stop offset="1" data-s="rail" />
        </radialGradient>
        <radialGradient id={`${id}-slope`} r="0.5">
          <stop offset="0.7" data-s="rail-lo" />
          <stop offset="1" data-s="groove-hi" />
        </radialGradient>
        <radialGradient id={`${id}-cone`} r="0.5" fx="0.42" fy="0.36">
          <stop offset="0" data-s="groove-hi" />
          <stop offset="0.75" data-s="felt-edge" />
          <stop offset="1" data-s="rail-lo" />
        </radialGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" data-s="sheen" stopOpacity="0.2" />
          <stop offset="0.45" data-s="sheen" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-lamp`} cx="0.44" cy="0.3" r="0.62">
          <stop offset="0" data-s="lamp" stopOpacity="0.22" />
          <stop offset="1" data-s="lamp" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-turret`} fx="0.38" fy="0.32" r="0.6">
          <stop offset="0" data-s="ivory-hi" />
          <stop offset="1" data-s="ivory-lo" />
        </radialGradient>
        <radialGradient id={`${id}-ball`} fx="0.35" fy="0.3" r="0.6">
          <stop offset="0" data-s="ivory-hi" />
          <stop offset="0.6" data-s="ivory" />
          <stop offset="1" data-s="ivory-lo" />
        </radialGradient>
      </defs>
      <g transform={`scale(1 ${TILT})`}>
        <circle data-w="bowl" r="158" cy="12" />
        <circle r="158" fill={url("rim")} />
        <circle r="158" fill={url("light")} />
        <circle data-w="gloss" r="155" />
        <path data-w="glint" d={GLINT} />
        <circle data-w="track" r="150" />
        <circle data-w="line" r="150" />
        <circle r="128" fill={url("slope")} />
        <circle data-w="line" r="128" />
        {DEFLECTORS.map((d, j) => (
          <path key={j} data-w="deflector" d={d} />
        ))}
        <g ref={headRef} data-landed={lit == null ? undefined : ""}>
          <circle data-w="head-base" r="116.5" />
          {POCKETS.map((pocket) => {
            const on = pocket.n === lit ? "" : undefined;
            return (
              <React.Fragment key={pocket.n}>
                <path data-c={pocket.colour} data-n={pocket.n} data-lit={on} d={pocket.wall} />
                <path
                  data-c={pocket.colour}
                  data-w="floor"
                  data-n={pocket.n}
                  data-lit={on}
                  d={pocket.floor}
                />
                <text
                  data-w="num"
                  data-n={pocket.n}
                  data-lit={on}
                  transform={`rotate(${pocket.turn}) translate(0 -108)`}
                >
                  {pocket.n}
                </text>
              </React.Fragment>
            );
          })}
          {POCKETS.map((pocket) => (
            <path key={pocket.n} data-w="fret" d={pocket.fret} />
          ))}
          <circle data-w="line" r="100" />
          <circle data-w="band" r="116.5" />
          <circle data-w="band-inner" r="82.5" />
          <path
            data-w="lit-ring"
            d={litAt == null ? "" : wedge(82, 116, litAt - SEG / 2, litAt + SEG / 2)}
          />
          <circle r="82" fill={url("cone")} />
          <circle data-w="cone-line" r="82" />
          <circle data-w="cone-line" r="58" />
          {ARMS.map((arm, j) => (
            <React.Fragment key={j}>
              <path data-w="arm" d={arm.d} />
              <circle data-w="knob" cx={arm.cx} cy={arm.cy} r="5" />
            </React.Fragment>
          ))}
          <circle data-w="turret" r="12" fill={url("turret")} />
        </g>
        <circle data-w="lamp" r="158" fill={url("lamp")} />
      </g>
      <g ref={ballRef}>
        <ellipse data-w="ball-shadow" rx="7" ry="5.5" cx="1.6" cy="3.2" />
        <circle r="6.6" fill={url("ball")} />
        <circle data-w="ball-glint" r="1.9" cx="-2.2" cy="-2.4" />
      </g>
    </svg>
  );
});
