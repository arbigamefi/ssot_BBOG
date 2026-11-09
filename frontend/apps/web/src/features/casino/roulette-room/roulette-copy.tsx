"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatRolls } from "../table-room/room-receipt";
import { betNames, pocketColour, type SpotName } from "./roulette-model";

/** Where a ball goes inside a translated sentence; the sentence is split on it. */
const SLOT = "⁣";

/**
 * The roulette words: spot and bet names, and a result read as words ("17 black") for screen
 * readers and the receipt's text. Results are shown as number balls, never as these words.
 */
export function useRouletteCopy() {
  const t = useTranslations("casino.roulette");
  const locale = useLocale();
  return React.useMemo(() => {
    const spotName = (name: SpotName, form: "spot" | "short") => {
      const key = `${form}.${name.key}` as const;
      return name.key === "number"
        ? t(key, { n: name.n })
        : name.key === "dozen"
          ? t(key, { from: name.from, to: name.to })
          : name.key === "column"
            ? t(key, { c: name.c })
            : t(key);
    };
    /** One spot is its name; several are joined by "+", past four with how many more. */
    const betName = (spots: readonly string[]) => {
      const { names, more } = betNames(spots);
      if (names.length === 0) return null;
      if (names.length === 1) return spotName(names[0]!, "spot");
      const parts = names.map((name) => spotName(name, "short"));
      if (more > 0) parts.push(t("slip.more", { count: more }));
      return parts.join(" + ");
    };
    const words = (n: number) => {
      const colour = pocketColour(n);
      return colour === "zero"
        ? t("receipt.zero")
        : t("receipt.one", { n, colour: t(`colour.${colour}`) });
    };
    /** "Came up 17 black." as text, for the receipt's line and the screen reader. */
    const rolledText = (values: readonly number[], won: number) =>
      values.length > 1
        ? t("receipt.rolledRounds", {
            rolls: formatRolls(locale, values.map(words)),
            won,
            count: values.length
          })
        : t("receipt.rolled", { rolls: words(values[0]!) });
    /** The same sentence with the results as balls in place of the words. */
    const rolledPrint = (
      values: readonly number[],
      won: number,
      on: "felt" | "paper"
    ): React.ReactNode => {
      const text =
        values.length > 1
          ? t("receipt.rolledRounds", { rolls: SLOT, won, count: values.length })
          : t("receipt.rolled", { rolls: SLOT });
      const [before, after] = text.split(SLOT);
      return (
        <>
          <span className="sr-only">{rolledText(values, won)}</span>
          <span aria-hidden="true">
            {before}
            <PocketBalls values={values} on={on} />
            {after}
          </span>
        </>
      );
    };
    return { t, spotName, betName, words, rolledText, rolledPrint };
  }, [locale, t]);
}

/**
 * A result: a ball in its pocket's colour with the number on it. Its words are read out unless
 * the caller reads the whole sentence.
 */
export function PocketBall({
  n,
  on = "felt",
  latest,
  size = "sm",
  words,
  className = ""
}: {
  n: number;
  on?: "felt" | "paper";
  latest?: boolean;
  size?: "sm" | "lg";
  /** What a screen reader hears; leave out when the ball is part of a sentence read elsewhere. */
  words?: string;
  className?: string;
}) {
  return (
    <span
      data-c={pocketColour(n)}
      data-on={on === "paper" ? "paper" : undefined}
      data-latest={latest || undefined}
      data-size={size === "lg" ? "lg" : undefined}
      className={`pocket-ball align-middle ${className}`}
    >
      {words ? <span className="sr-only">{words}</span> : null}
      <b aria-hidden="true" className="font-extrabold">
        {n}
      </b>
    </span>
  );
}

function PocketBalls({ values, on }: { values: readonly number[]; on: "felt" | "paper" }) {
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {values.map((n, k) => (
        <PocketBall
          key={k}
          n={n}
          on={on}
          className={on === "paper" ? "size-[22px] text-[10px]" : "size-6 text-[11px]"}
        />
      ))}
    </span>
  );
}
