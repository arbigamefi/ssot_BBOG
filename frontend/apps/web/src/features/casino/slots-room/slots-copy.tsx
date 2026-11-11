"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { SYMBOLS } from "./slots-model";

/** Where a strip goes inside a translated sentence; the sentence is split on it. */
const SLOT = "⁣";

/** The reel art: each symbol screen-printed in rail navy (k) and lacquer red (r) on ivory. */
const ART: readonly React.ReactNode[] = [
  // 0 cherry
  <>
    <path data-i="ks" d="M36 60C38 42 46 28 64 16" />
    <path data-i="ks" d="M64 16C62 32 66 44 70 54" />
    <path data-i="k" d="M64 16C72 8 84 8 90 14C82 22 70 22 64 16Z" />
    <circle data-i="r" cx="34" cy="68" r="18" />
    <circle data-i="r" cx="70" cy="66" r="16" />
    <path data-i="hi" d="M25 63a10 10 0 0 1 8-7" />
    <path data-i="hi" d="M62 61a9 9 0 0 1 7-6" />
  </>,
  // 1 lemon
  <>
    <path
      data-i="k"
      d="M10 50C10 46 13 43 17 42C24 28 38 22 52 22C66 22 78 28 84 40C88 41 91 45 90 50C91 55 88 59 84 60C78 72 66 78 52 78C38 78 24 72 17 58C13 57 10 54 10 50Z"
    />
    <path data-i="hi" d="M29 40C35 33 43 30 52 30" />
  </>,
  // 2 bell
  <>
    <rect data-i="k" x="45" y="8" width="10" height="10" rx="3" />
    <path
      data-i="k"
      d="M50 16C31 16 25 32 25 48C25 62 20 68 12 74C12 78 14 80 18 80H82C86 80 88 78 88 74C80 68 75 62 75 48C75 32 69 16 50 16Z"
    />
    <circle data-i="r" cx="50" cy="86" r="8" />
    <path data-i="hi" d="M36 30C33 36 32 44 32 52" />
  </>,
  // 3 diamond
  <>
    <path data-i="r" d="M28 24H72L90 44L50 90L10 44Z" />
    <path data-i="facet" d="M10 44H90M28 24L36 44L50 90L64 44L72 24M36 44L50 24L64 44" />
  </>,
  // 4 crown
  <>
    <path data-i="k" d="M14 34L32 54L50 26L68 54L86 34L80 74H20Z" />
    <rect data-i="k" x="18" y="78" width="64" height="10" rx="3" />
    <circle data-i="r" cx="14" cy="30" r="7" />
    <circle data-i="r" cx="50" cy="20" r="7" />
    <circle data-i="r" cx="86" cy="30" r="7" />
    <circle data-i="r" cx="50" cy="62" r="6" />
  </>,
  // 5 star
  <>
    <path
      data-i="r"
      d="M50 10L59.4 37.1L88 37.6L65.2 54.9L73.5 82.4L50 66L26.5 82.4L34.8 54.9L12 37.6L40.6 37.1Z"
    />
    <path data-i="hi" d="M50 22L45 36" />
  </>,
  // 6 bar: the word is part of the symbol's print, not copy
  <>
    <rect data-i="k" x="8" y="32" width="84" height="36" rx="7" />
    <rect data-i="rim" x="13" y="37" width="74" height="26" rx="4" />
    <text data-i="bar" x="50" y="58.5">
      BAR
    </text>
  </>,
  // 7 seven
  <>
    <path data-i="seven" d="M18 16H84V30C68 46 58 64 54 90H32C36 66 46 48 60 34H18Z" />
  </>
];

/** One reel symbol. */
export function SlotGlyph({ s, className = "" }: { s: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={`slot-glyph ${className}`}
    >
      {ART[s]}
    </svg>
  );
}

/**
 * A spin's three symbols on a small tab. Its words are read out unless the caller reads the whole
 * sentence.
 */
export function SlotTrio({
  symbols,
  paid,
  on = "felt",
  latest,
  words,
  size = 18
}: {
  symbols: readonly number[];
  paid: boolean;
  on?: "felt" | "paper";
  latest?: boolean;
  /** What a screen reader hears; leave out when the strip is part of a sentence read elsewhere. */
  words?: string;
  /** The symbols' size in pixels. */
  size?: 18 | 20;
}) {
  return (
    <span
      data-paid={paid || undefined}
      data-latest={latest || undefined}
      data-on={on === "paper" ? "paper" : undefined}
      className="slot-trio"
    >
      {words ? <span className="sr-only">{words}</span> : null}
      {symbols.map((s, i) => (
        <SlotGlyph key={i} s={s} className={size === 20 ? "size-5" : "size-[18px]"} />
      ))}
    </span>
  );
}

export type Spin = { symbols: readonly number[]; paid: boolean };

/**
 * The slots words: symbol names, and a spin read as words ("seven, seven, seven") for screen
 * readers and the receipt's text. Spins are shown as symbol strips, never as these words.
 */
export function useSlotsCopy() {
  const t = useTranslations("casino.slots");
  return React.useMemo(() => {
    const symbolName = (s: number) => t(`symbol.${SYMBOLS[s] ?? "cherry"}`);
    const words = (symbols: readonly number[]) =>
      t("receipt.trio", {
        a: symbolName(symbols[0]!),
        b: symbolName(symbols[1]!),
        c: symbolName(symbols[2]!)
      });
    /** "Came up seven, seven, seven." as text, for the receipt's line and the screen reader. */
    const rolledText = (spins: readonly Spin[]) => {
      const paid = spins.filter((spin) => spin.paid).length;
      return spins.length > 1
        ? t("receipt.rolledRounds", {
            rolls: spins.map((spin) => words(spin.symbols)).join(t("receipt.between")),
            paid,
            count: spins.length
          })
        : t("receipt.rolled", { rolls: words(spins[0]!.symbols) });
    };
    /** The same sentence with the spins as strips in place of the words. */
    const rolledPrint = (spins: readonly Spin[], on: "felt" | "paper"): React.ReactNode => {
      const paid = spins.filter((spin) => spin.paid).length;
      const text =
        spins.length > 1
          ? t("receipt.rolledRounds", { rolls: SLOT, paid, count: spins.length })
          : t("receipt.rolled", { rolls: SLOT });
      const [before, after] = text.split(SLOT);
      return (
        <>
          <span className="sr-only">{rolledText(spins)}</span>
          <span aria-hidden="true">
            {before}
            <span className="inline-flex flex-wrap gap-1 align-middle">
              {spins.map((spin, k) => (
                <SlotTrio
                  key={k}
                  symbols={spin.symbols}
                  paid={spin.paid}
                  on={on}
                  size={on === "paper" ? 18 : 20}
                />
              ))}
            </span>
            {after}
          </span>
        </>
      );
    };
    return { t, symbolName, words, rolledText, rolledPrint };
  }, [t]);
}
