"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

/** Stands in for the path in a sentence, so the sentence can be split around it. */
const PATH = "⁣";

/** A ball as the table and the paper show it: its bounces, its cup and what that cup pays. */
export type Drop = {
  /** One per row: true for a right. */
  bits: readonly boolean[];
  cup: number;
  /** What the cup pays per unit staked, cut to two decimals: "8.10". */
  multiple: string;
  /** The cup paid more than the stake. */
  paid: boolean;
};

/**
 * A ball's path as eight printed ticks, \ for a left and / for a right. Decorative: the sentence
 * around it is read out with the path in words.
 */
export function PlinkoPath({ bits }: { bits: readonly boolean[] }) {
  return (
    <span aria-hidden="true" className="plinko-path">
      {bits.map((right, r) => (
        <i key={r} data-right={right || undefined} />
      ))}
    </span>
  );
}

/**
 * The plinko words: a path read out ("left, right, …"), and a result as a sentence ("Bounced
 * left, right, … into the 8.10× cup.") for the receipt's text and screen readers, or printed with
 * the path as ticks.
 */
export function usePlinkoCopy() {
  const t = useTranslations("casino.plinko");
  return React.useMemo(() => {
    const words = (bits: readonly boolean[]) =>
      bits.map((right) => t(right ? "receipt.right" : "receipt.left")).join(t("receipt.step"));
    const sentence = (drops: readonly Drop[], path: string) => {
      const last = drops.at(-1);
      if (!last) return "";
      return drops.length > 1
        ? t("receipt.fellMany", {
            path,
            m: last.multiple,
            list: drops.map((drop) => `${drop.multiple}×`).join(t("receipt.between"))
          })
        : t("receipt.fell", { path, m: last.multiple });
    };
    const fellText = (drops: readonly Drop[]) => sentence(drops, words(drops.at(-1)?.bits ?? []));
    const fellPrint = (drops: readonly Drop[]): React.ReactNode => {
      const [before, after] = sentence(drops, PATH).split(PATH);
      return (
        <>
          <span className="sr-only">{fellText(drops)}</span>
          <span aria-hidden="true">
            {before}
            <PlinkoPath bits={drops.at(-1)?.bits ?? []} />
            {after}
          </span>
        </>
      );
    };
    return { t, words, fellText, fellPrint };
  }, [t]);
}
