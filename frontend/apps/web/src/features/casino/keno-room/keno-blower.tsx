"use client";

import * as React from "react";

import {
  BALL,
  DRAWN,
  GLOBE,
  POOL,
  RACK_X,
  slotY,
  TUBE_PATH,
  type BlowerMotion
} from "./blower-motion";

const C = GLOBE;

/** Move each ball's group to where the blower has it. Runs on every frame, outside React. */
export function drawBlower(balls: ReadonlyArray<SVGGElement | null>, motion: BlowerMotion) {
  motion.balls.forEach((ball, i) => {
    balls[i]?.setAttribute("transform", `translate(${ball.x.toFixed(1)} ${ball.y.toFixed(1)})`);
  });
}

/** Mark ball `n` as one of the player's numbers (red) or not. */
export function markBall(balls: ReadonlyArray<SVGGElement | null>, n: number, hit: boolean) {
  const g = balls[n - 1];
  if (!g) return;
  if (hit) g.setAttribute("data-hit", "");
  else g.removeAttribute("data-hit");
}

/**
 * The blower: a glass globe on a stand, with a chrome rim and two collars, a glass tube over the
 * top to a rack of five, and fifteen ivory balls. The balls are moved by the frame loop
 * (`drawBlower`), not by React; drawn balls that are the player's numbers turn red (`markBall`).
 * Decorative: the board and the status say what was drawn.
 */
export const KenoBlower = React.memo(function KenoBlower({
  ballRefs,
  mixing
}: {
  ballRefs: React.MutableRefObject<Array<SVGGElement | null>>;
  mixing: boolean;
}) {
  const id = `kn${React.useId().replace(/:/g, "")}`;
  const url = (name: string) => `url(#${id}-${name})`;
  return (
    <svg
      viewBox="0 0 340 292"
      aria-hidden="true"
      focusable="false"
      data-mixing={mixing || undefined}
      className="table-blower"
    >
      <defs>
        <radialGradient id={`${id}-ivory`} cx=".34" cy=".28" r=".75">
          <stop offset="0" data-s="ivory-hi" />
          <stop offset=".55" data-s="ivory" />
          <stop offset="1" data-s="ivory-lo" />
        </radialGradient>
        <radialGradient id={`${id}-red`} cx=".34" cy=".28" r=".75">
          <stop offset="0" data-s="red-hi" />
          <stop offset=".6" data-s="red" />
          <stop offset="1" data-s="red-lo" />
        </radialGradient>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" data-s="ivory-hi" />
          <stop offset=".22" data-s="rail-hi" />
          <stop offset=".5" data-s="ivory-lo" />
          <stop offset=".78" data-s="rail-lo" />
          <stop offset="1" data-s="rail-hi" />
        </linearGradient>
        <linearGradient id={`${id}-collar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" data-s="rail-lo" />
          <stop offset=".3" data-s="ivory-lo" />
          <stop offset=".45" data-s="ivory-hi" />
          <stop offset=".7" data-s="rail-hi" />
          <stop offset="1" data-s="rail-lo" />
        </linearGradient>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" data-s="rail-hi" />
          <stop offset=".3" data-s="rail" />
          <stop offset="1" data-s="rail-lo" />
        </linearGradient>
        <radialGradient id={`${id}-back`} cx=".5" cy=".62" r=".6">
          <stop offset="0" data-s="glass-in" />
          <stop offset=".85" data-s="glass-mid" />
          <stop offset="1" data-s="glass-out" />
        </radialGradient>
        <radialGradient id={`${id}-front`} cx=".32" cy=".24" r=".8">
          <stop offset="0" data-s="sheen" />
          <stop offset=".35" data-s="sheen-soft" />
          <stop offset=".9" data-s="clear" />
          <stop offset="1" data-s="sheen-edge" />
        </radialGradient>
      </defs>
      <path
        data-b="stand"
        fill={url("base")}
        d={`M${C.x - 62} 291 Q${C.x - 60} 278 ${C.x - 40} 272 L${C.x - 26} 258 H${C.x + 26} L${C.x + 40} 272 Q${C.x + 60} 278 ${C.x + 62} 291 Z`}
      />
      <path data-b="stand-hi" d={`M${C.x - 40} 272.5 H${C.x + 40}`} />
      <path data-b="tube-edge" d={TUBE_PATH} />
      <path data-b="tube-floor" d={TUBE_PATH} />
      <path data-b="tube" d={TUBE_PATH} />
      {Array.from({ length: DRAWN }, (_, k) => (
        <circle key={k} data-b="slot" cx={RACK_X} cy={slotY(k)} r={BALL - 2} />
      ))}
      <circle data-b="globe-back" fill={url("back")} cx={C.x} cy={C.y} r={C.r} />
      <ellipse data-b="vent" cx={C.x} cy={C.y + C.r - 6} rx="22" ry="5" />
      <path
        data-b="air"
        d={`M${C.x - 14} ${C.y + C.r - 10} q-6 -40 4 -80 M${C.x} ${C.y + C.r - 10} q4 -50 -2 -96 M${C.x + 14} ${C.y + C.r - 10} q8 -38 -2 -74`}
      />
      <g>
        {Array.from({ length: POOL }, (_, i) => (
          <g
            key={i}
            data-ball=""
            ref={(el) => {
              ballRefs.current[i] = el;
            }}
          >
            <circle r={BALL} fill={url("ivory")} data-face="ivory" />
            <circle r={BALL} fill={url("red")} data-face="red" />
            <circle r={BALL + 2.5} data-face="ring" />
            <text>{i + 1}</text>
          </g>
        ))}
      </g>
      <circle data-b="globe-front" fill={url("front")} cx={C.x} cy={C.y} r={C.r} />
      <circle data-b="chrome" stroke={url("chrome")} cx={C.x} cy={C.y} r={C.r + 3.5} />
      <rect
        data-b="collar"
        fill={url("collar")}
        x={C.x - 30}
        y={C.y + C.r - 4}
        width="60"
        height="12"
        rx="3"
      />
      <rect
        data-b="collar"
        fill={url("collar")}
        x={C.x - 25}
        y={C.y - C.r - 7}
        width="50"
        height="10"
        rx="3"
      />
      <path
        data-b="glint"
        d={`M${C.x - 84} ${C.y - 52} A ${C.r - 14} ${C.r - 14} 0 0 1 ${C.x - 40} ${C.y - 92}`}
      />
    </svg>
  );
});
