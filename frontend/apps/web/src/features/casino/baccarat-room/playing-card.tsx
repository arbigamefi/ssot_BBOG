"use client";

import * as React from "react";

import { reducedMotion } from "../table-room/table-controls";
import { isRed, rankLabel, type Suit } from "./baccarat-model";

/** The four suits in a 100 × 100 box: spade, heart, diamond, club. */
const SUIT_PATHS = [
  "M50 6C62 25 92 40 92 61c0 13-10 21-21 21-8 0-14-4-17-9 1 10 5 17 12 22H34c7-5 11-12 12-22-3 5-9 9-17 9C18 82 8 74 8 61 8 40 38 25 50 6z",
  "M50 90C20 66 6 50 6 33 6 19 17 9 30 9c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 24 0 17-14 33-44 57z",
  "M50 4l38 46-38 46-38-46z",
  "M50 8a18 18 0 0 1 15 28 18 18 0 1 1-8 29c1 11 5 19 13 25H30c8-6 12-14 13-25a18 18 0 1 1-8-29A18 18 0 0 1 50 8z"
] as const;

export function SuitGlyph({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path d={SUIT_PATHS[suit]} fill="currentColor" />
    </svg>
  );
}

/** A card's rank and suit as printed ink, red for hearts and diamonds: the paper and the status. */
export function CardMark({ rank, suit }: { rank: number; suit: Suit }) {
  return (
    <span className="card-mark" data-red={isRed(suit) || undefined}>
      {rankLabel(rank)}
      <SuitGlyph suit={suit} />
    </span>
  );
}

/**
 * A playing card on the felt: ivory with navy and lacquer-red ink, a navy lattice back. Pictures
 * show only their letter in a printed frame. A card mounted with `shoe` slides out of the shoe face
 * down; it turns over when `up` becomes true. A blank card (`rank` null) has no face yet.
 */
export function PlayingCard({
  rank,
  suit,
  up,
  gone,
  delay,
  shoe
}: {
  rank: number | null;
  suit: Suit;
  up: boolean;
  gone: boolean;
  /** Milliseconds before it leaves the shoe. */
  delay: number;
  shoe: React.RefObject<HTMLElement | null>;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  // Dealt: slide from the shoe's mouth to the spot, turning square as it lands.
  React.useLayoutEffect(() => {
    const card = ref.current;
    const from = shoe.current;
    if (!card || !from || reducedMotion() || typeof card.animate !== "function") return;
    const a = from.getBoundingClientRect();
    const b = card.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const end = getComputedStyle(card).transform;
    card.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) rotate(-14deg) scale(0.8)` },
        { transform: end === "none" ? "none" : end }
      ],
      { duration: 380, delay, easing: "cubic-bezier(.2, .7, .3, 1)", fill: "backwards" }
    );
    // A card is dealt once, when it mounts.
  }, []);

  const label = rank == null ? "" : rankLabel(rank);
  const glyph = <SuitGlyph suit={suit} />;
  return (
    <span ref={ref} className="table-card" data-up={up || undefined} data-gone={gone || undefined}>
      <span data-c="in">
        <span data-c="face" data-red={isRed(suit) || undefined}>
          {rank == null ? null : (
            <>
              <span data-c="idx">
                {label}
                {glyph}
              </span>
              {rank >= 10 ? (
                <span data-c="frame">
                  {label}
                  {glyph}
                </span>
              ) : (
                <SuitGlyph suit={suit} className="pip" />
              )}
              <span data-c="idx" data-end="">
                {label}
                {glyph}
              </span>
            </>
          )}
        </span>
        <span data-c="back" />
      </span>
    </span>
  );
}
