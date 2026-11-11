"use client";

import * as React from "react";

import {
  BALL_R,
  CRADLE_HALF,
  cradleY,
  CUP_FLOOR,
  CUP_TOP,
  CUPS,
  cupX,
  CX,
  GATE,
  PIN_R,
  PINS,
  SPACE,
  type DropMotion
} from "./drop-motion";

const troughY = (dx: number) => cradleY(dx) + BALL_R + 2.5;

/** One side of the cradle's trough, from the gate out: a curve that follows the cradle. */
function troughSide(side: 1 | -1) {
  const a = GATE * side;
  const b = 56 * side;
  const ya = troughY(a);
  const yb = troughY(b);
  const slope = (dx: number) => (-18 * dx) / CRADLE_HALF ** 2;
  // The control point is where the tangents at both ends meet.
  const xc = (yb - ya + slope(a) * a - slope(b) * b) / (slope(a) - slope(b));
  const yc = ya + slope(a) * (xc - a);
  return `M${CX + a} ${ya} Q${CX + xc} ${yc} ${CX + b} ${yb}`;
}

export type BoardRefs = {
  svg: SVGSVGElement | null;
  balls: Array<SVGGElement | null>;
  traces: Array<SVGPolylineElement | null>;
};

const at = (n: number) => n.toFixed(1);

/** Move the balls and their traces to where the drop has them. Runs on every frame, outside React. */
export function drawBoard(refs: BoardRefs, motion: DropMotion) {
  refs.svg?.toggleAttribute("data-open", motion.open);
  const balls = motion.balls;
  // The latest ball that has left the gate prints bright; earlier traces fade.
  let newest = -1;
  balls.forEach((b, i) => {
    if (b.reached > 0) newest = i;
  });
  balls.forEach((b, i) => {
    const g = refs.balls[i];
    if (g) {
      g.setAttribute("transform", `translate(${at(b.x)} ${at(b.y)})`);
      g.toggleAttribute("data-gone", b.mode === "gone");
    }
    const line = refs.traces[i];
    if (line) {
      line.setAttribute(
        "points",
        motion
          .trail(b)
          .map((p) => `${at(p.x)},${at(p.y)}`)
          .join(" ")
      );
      line.toggleAttribute("data-old", i !== newest);
    }
  });
}

/** Light pin `j` of row `r` for a moment, as a ball hits it. */
export function flashPin(svg: SVGSVGElement | null, r: number, j: number) {
  const pin = svg?.querySelector(`[data-p="${r}:${j}"]`);
  if (!pin) return;
  pin.setAttribute("data-hit", "");
  setTimeout(() => pin.removeAttribute("data-hit"), 140);
}

/**
 * The pin board: eight rows of ivory pins in a well in the felt, the outer pins making the
 * triangle and the last row's pins standing on the walls of nine cups. A chrome cradle holds the
 * lacquer-red ball at the top, over a gate. The balls and their dotted traces are moved by the
 * frame loop (`drawBoard`), not by React. The cups a result landed in light (`now`); a cup that
 * paid more than the stake glows (`win`); a tag over a cup counts its balls when there are two or
 * more. Decorative: the status and the receipt say where each ball went.
 */
export const PlinkoBoard = React.memo(function PlinkoBoard({
  refs,
  balls,
  counts,
  now,
  win
}: {
  refs: React.MutableRefObject<BoardRefs>;
  /** How many balls the bet drops. */
  balls: number;
  /** How many balls have landed in each cup. */
  counts: readonly number[];
  now: readonly number[];
  win: readonly number[];
}) {
  const id = `pk${React.useId().replace(/:/g, "")}`;
  const url = (name: string) => `url(#${id}-${name})`;
  const cups = Array.from({ length: CUPS }, (_, k) => k);
  return (
    <svg
      ref={(el) => {
        refs.current.svg = el;
      }}
      viewBox="0 0 360 334"
      aria-hidden="true"
      focusable="false"
      className="table-pegs"
    >
      <defs>
        <radialGradient id={`${id}-pin`} cx=".35" cy=".3" r=".8">
          <stop offset="0" data-s="ivory-hi" />
          <stop offset=".6" data-s="ivory" />
          <stop offset="1" data-s="ivory-lo" />
        </radialGradient>
        <radialGradient id={`${id}-ball`} cx=".34" cy=".28" r=".8">
          <stop offset="0" data-s="red-hi" />
          <stop offset=".6" data-s="red" />
          <stop offset="1" data-s="red-lo" />
        </radialGradient>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" data-s="rail-lo" />
          <stop offset=".3" data-s="ivory-lo" />
          <stop offset=".5" data-s="ivory-hi" />
          <stop offset=".72" data-s="rail-hi" />
          <stop offset="1" data-s="rail-lo" />
        </linearGradient>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" data-s="ivory-lo" />
          <stop offset=".5" data-s="ivory-hi" />
          <stop offset="1" data-s="ivory-lo" />
        </linearGradient>
      </defs>
      <g>
        {cups.map((k) => (
          <rect
            key={k}
            data-b="cup"
            data-now={now.includes(k) || undefined}
            data-win={win.includes(k) || undefined}
            x={cupX(k) - SPACE / 2 + 1.5}
            y={CUP_TOP}
            width={SPACE - 3}
            height={CUP_FLOOR - CUP_TOP}
          />
        ))}
        {Array.from({ length: CUPS + 1 }, (_, k) => (
          <rect
            key={k}
            fill={url("wall")}
            x={cupX(k) - SPACE / 2 - 1.5}
            y={CUP_TOP}
            width="3"
            height={CUP_FLOOR - CUP_TOP}
            rx="1.5"
          />
        ))}
        <rect fill={url("wall")} x="-1.5" y={CUP_FLOOR} width="363" height="4" rx="2" />
        {cups.map((k) => (
          <text key={k} data-b="tally" x={cupX(k)} y={CUP_TOP - 4}>
            {(counts[k] ?? 0) > 1 ? `×${counts[k]}` : ""}
          </text>
        ))}
      </g>
      <g>
        {Array.from({ length: balls }, (_, i) => (
          <polyline
            key={i}
            data-b="trace"
            ref={(el) => {
              refs.current.traces[i] = el;
            }}
          />
        ))}
      </g>
      <g>
        {PINS.map((pin) => (
          <circle
            key={`${pin.r}:${pin.j}`}
            data-b="pin"
            data-p={`${pin.r}:${pin.j}`}
            fill={url("pin")}
            cx={pin.x}
            cy={pin.y}
            r={PIN_R}
          />
        ))}
      </g>
      <path data-b="trough" stroke={url("chrome")} d={troughSide(-1)} />
      <path data-b="trough" stroke={url("chrome")} d={troughSide(1)} />
      <rect
        data-b="gate"
        fill={url("chrome")}
        x={CX - GATE}
        y={troughY(0) - 2.5}
        width={GATE * 2}
        height="5"
        rx="2.5"
      />
      <g>
        {Array.from({ length: balls }, (_, i) => (
          <g
            key={i}
            data-b="ball"
            ref={(el) => {
              refs.current.balls[i] = el;
            }}
          >
            <circle r={BALL_R} fill={url("ball")} />
            <circle data-b="shine" cx="-3" cy="-3.4" r="2.4" />
          </g>
        ))}
      </g>
    </svg>
  );
});
