"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

/** Stands in for the balls in a sentence, so the sentence can be split around them. */
const BALLS = "⁣";

/** A round as the table and the paper show it: the five numbers drawn and the player's picks. */
export type Draw = { numbers: readonly number[]; hits: number; paid: boolean };

/**
 * The drawn numbers as small balls, the player's in red. Screen readers hear the numbers when
 * `words` is given; leave it out when the balls are part of a sentence read elsewhere.
 */
export function KenoBalls({
  numbers,
  picks,
  on = "felt",
  words
}: {
  numbers: readonly number[];
  picks: readonly number[];
  on?: "felt" | "paper";
  words?: string;
}) {
  return (
    <span className="inline-flex flex-wrap gap-0.5 align-middle">
      {words ? <span className="sr-only">{words}</span> : null}
      {numbers.map((n) => (
        <span
          key={n}
          aria-hidden="true"
          data-hit={picks.includes(n) || undefined}
          data-on={on === "paper" ? "paper" : undefined}
          className="keno-ball"
        >
          {n}
        </span>
      ))}
    </span>
  );
}

/**
 * The keno words: a list of numbers, and a result read as a sentence ("Drew 1, 4, 7, 9, 12. 2 of
 * 3 hit.") for the receipt's text and screen readers, or printed with the drawn balls.
 */
export function useKenoCopy() {
  const t = useTranslations("casino.keno");
  return React.useMemo(() => {
    const list = (numbers: readonly number[]) => numbers.join(t("receipt.between"));
    const sentence = (draws: readonly Draw[], picked: number, balls: string) =>
      draws.length > 1
        ? t("receipt.drewRounds", {
            balls,
            list: draws.map((draw) => draw.hits).join(t("receipt.between"))
          })
        : t("receipt.drew", { balls, hits: draws[0]?.hits ?? 0, picked });
    const drewText = (draws: readonly Draw[], picked: number) =>
      sentence(draws, picked, list(draws.at(-1)?.numbers ?? []));
    const drewPrint = (
      draws: readonly Draw[],
      picks: readonly number[],
      on: "felt" | "paper"
    ): React.ReactNode => {
      const [before, after] = sentence(draws, picks.length, BALLS).split(BALLS);
      return (
        <>
          <span className="sr-only">{drewText(draws, picks.length)}</span>
          <span aria-hidden="true">
            {before}
            <KenoBalls numbers={draws.at(-1)?.numbers ?? []} picks={picks} on={on} />
            {after}
          </span>
        </>
      );
    };
    return { t, list, drewText, drewPrint };
  }, [t]);
}
