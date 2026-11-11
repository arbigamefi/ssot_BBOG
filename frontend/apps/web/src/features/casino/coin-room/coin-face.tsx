"use client";

import * as React from "react";

import type { CoinSide } from "../room/params";

/** The sun's twelve rays, as one path around the centre of a 100 × 100 face. */
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  const p = (r: number, da: number) =>
    `${(50 + Math.cos(a + da) * r).toFixed(2)} ${(50 + Math.sin(a + da) * r).toFixed(2)}`;
  return `M${p(18, -0.13)} L${p(29, 0)} L${p(18, 0.13)} Z`;
}).join(" ");

/**
 * One face of the coin, for the table: heads is ivory with a navy sun, tails lacquer red with an
 * ivory moon. No words, so it reads the same in every language. Coloured by the `coin-face`
 * utility through data-s gradient stops and data-b parts.
 */
export function CoinFace({ side }: { side: CoinSide }) {
  const id = `cf${React.useId().replace(/:/g, "")}`;
  const tails = side === "TAILS";
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className="coin-face"
      data-side={tails ? "tails" : "heads"}
    >
      <defs>
        <radialGradient id={`${id}-g`} cx=".36" cy=".3" r=".8">
          <stop offset="0" data-s={tails ? "red-hi" : "ivory-hi"} />
          <stop offset=".6" data-s={tails ? "red" : "ivory"} />
          <stop offset="1" data-s={tails ? "red-lo" : "ivory-lo"} />
        </radialGradient>
        <radialGradient id={`${id}-l`} cx=".3" cy=".22" r=".55">
          <stop offset="0" data-s="gloss" />
          <stop offset="1" data-s="clear" />
        </radialGradient>
        {tails ? (
          <mask id={`${id}-m`}>
            <rect width="100" height="100" fill="white" />
            <circle cx="59" cy="43" r="17.5" fill="black" />
          </mask>
        ) : null}
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${id}-g)`} />
      <circle data-b="rim" cx="50" cy="50" r="45.5" />
      <circle data-b="dots" cx="50" cy="50" r="40" />
      {tails ? (
        <>
          <circle data-b="mark" cx="50" cy="50" r="21" mask={`url(#${id}-m)`} />
          <circle data-b="mark" cx="66" cy="62" r="2.4" />
          <circle data-b="mark" cx="70" cy="34" r="1.8" />
        </>
      ) : (
        <>
          <circle data-b="mark" cx="50" cy="50" r="13" />
          <path data-b="mark" d={RAYS} />
        </>
      )}
      <circle cx="50" cy="50" r="50" fill={`url(#${id}-l)`} />
    </svg>
  );
}

/**
 * The side as a printed mark, in the current colour, for the paper and the status line: a ring
 * around a sun or a moon. Decorative: the words beside it say the side.
 */
export function CoinMark({ tails }: { tails: boolean }) {
  const id = `cm${React.useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="coin-mark">
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="9" />
      {tails ? (
        <>
          <mask id={id}>
            <rect width="100" height="100" fill="white" />
            <circle cx="61" cy="41" r="20" fill="black" />
          </mask>
          <circle cx="50" cy="50" r="24" fill="currentColor" mask={`url(#${id})`} />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="13" fill="currentColor" />
          <path d={RAYS} fill="currentColor" />
        </>
      )}
    </svg>
  );
}
