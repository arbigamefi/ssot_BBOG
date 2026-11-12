"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { MiniDie } from "./sicbo-die";
import { diceTotal, type Area, type Dice } from "./sicbo-model";

/** A roll as the table and the paper show it: its dice, and whether it paid your area. */
export type Roll = { dice: Dice; won: boolean };

/**
 * The sic bo words: an area ("Big", "Triple 3s", "Total 9"), and a bet's result as a sentence
 * ("Rolled 3, 5, 6, total 14. You bet Big.") for the receipt's text and screen readers, or
 * printed after three small dice ("Total 14. You bet Big.").
 */
export function useSicBoCopy() {
  const t = useTranslations("casino.sicBo");
  return React.useMemo(() => {
    const area = ({ kind, value }: Area) => t("table.area", { kind, value });
    const diceText = (dice: Dice) => t("table.dice", { a: dice[0], b: dice[1], c: dice[2] });
    const rolledText = (rolls: readonly Roll[], bet: Area) => {
      const last = rolls.at(-1);
      if (!last) return "";
      const values = { dice: diceText(last.dice), total: diceTotal(last.dice) };
      return rolls.length > 1
        ? t("receipt.rolledMany", {
            ...values,
            hits: rolls.filter((roll) => roll.won).length,
            n: rolls.length
          })
        : t("receipt.rolled", { ...values, bet: area(bet) });
    };
    const dicePrint = (dice: Dice) => (
      <span className="mr-1.5 inline-flex gap-0.5 align-[-3px]">
        {dice.map((n, k) => (
          <MiniDie key={k} n={n} />
        ))}
      </span>
    );
    const rolledPrint = (rolls: readonly Roll[], bet: Area): React.ReactNode => {
      const last = rolls.at(-1);
      if (!last) return null;
      const total = diceTotal(last.dice);
      return (
        <>
          {dicePrint(last.dice)}
          {rolls.length > 1
            ? t("receipt.cameMany", {
                total,
                hits: rolls.filter((roll) => roll.won).length,
                n: rolls.length
              })
            : t("receipt.came", { total, bet: area(bet) })}
        </>
      );
    };
    return { t, area, diceText, dicePrint, rolledText, rolledPrint };
  }, [t]);
}
