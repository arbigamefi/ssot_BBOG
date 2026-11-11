"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { CoinSide } from "../room/params";
import { CoinMark } from "./coin-face";
import { sideKey } from "./coin-model";

/** A flip as the table and the paper show it: the side that came up, and whether it matched. */
export type Flip = { tails: boolean; match: boolean };

/**
 * The coin toss words: a side ("Heads"), and a result as a sentence ("Landed Heads. You called
 * Heads.") for the receipt's text and screen readers, or printed after the side's mark.
 */
export function useCoinCopy() {
  const t = useTranslations("casino.coin");
  return React.useMemo(() => {
    const face = (side: CoinSide) => t(`table.face.${sideKey(side)}`);
    const landedText = (flips: readonly Flip[], chosen: CoinSide) => {
      const last = flips.at(-1);
      if (!last) return "";
      const up = face(last.tails ? "TAILS" : "HEADS");
      return flips.length > 1
        ? t("receipt.landedMany", {
            face: up,
            hits: flips.filter((flip) => flip.match).length,
            n: flips.length
          })
        : t("receipt.landed", { face: up, call: face(chosen) });
    };
    const landedPrint = (flips: readonly Flip[], chosen: CoinSide): React.ReactNode => {
      const last = flips.at(-1);
      if (!last) return null;
      return (
        <>
          <CoinMark tails={last.tails} />
          {landedText(flips, chosen)}
        </>
      );
    };
    return { t, face, landedText, landedPrint };
  }, [t]);
}
