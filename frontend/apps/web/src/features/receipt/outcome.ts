import type { useTranslations } from "next-intl";
import type { CasinoOutcome } from "@ssot/ssot/domain";

import { diceWinRange } from "../casino/dice-room/slip-model";

type Translate = ReturnType<typeof useTranslations>;

/** Numbers as a list in the reader's language: "66, 45, 30, 48 and 20". */
export function formatList(locale: string, values: readonly (number | string)[]) {
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(values.map(String));
}

/** A roulette bet covering more numbers than this prints their count, not the list. */
const LISTED_NUMBERS = 6;

/**
 * What a bet was on and what the game drew, as the receipt's sentences, read from the bet's
 * parameters and random words. `t` is the root translator.
 */
export function describeOutcome(outcome: CasinoOutcome, t: Translate, locale: string): string[] {
  const list = (values: readonly (number | string)[]) => formatList(locale, values);
  const rounds = (won: number, count: number) =>
    count > 1 ? [t("receipt.outcome.rounds", { won, count })] : [];

  switch (outcome.kind) {
    case "dice": {
      const [from, to] = diceWinRange(outcome.direction, outcome.target);
      return [
        t("receipt.outcome.dice.wins", { from, to }),
        t("receipt.outcome.dice.rolled", { rolls: list(outcome.rolls.map((roll) => roll.value)) }),
        ...rounds(outcome.rolls.filter((roll) => roll.won).length, outcome.rolls.length)
      ];
    }
    case "coin-toss": {
      const side = (value: "HEADS" | "TAILS") =>
        t(`casino.room.selection.coin.${value === "HEADS" ? "heads" : "tails"}`);
      return [
        t("receipt.outcome.coin", {
          side: side(outcome.chosen),
          landed: list(outcome.rolls.map((roll) => side(roll.value)))
        }),
        ...rounds(outcome.rolls.filter((roll) => roll.won).length, outcome.rolls.length)
      ];
    }
    case "roulette": {
      const numbers = outcome.selectedNumbers;
      return [
        numbers.length > LISTED_NUMBERS
          ? t("receipt.outcome.roulette.covered", { count: numbers.length })
          : t("receipt.outcome.roulette.numbers", { numbers: list(numbers) }),
        t("receipt.outcome.roulette.landed", {
          numbers: list(outcome.rolls.map((roll) => roll.value))
        }),
        ...rounds(outcome.rolls.filter((roll) => roll.won).length, outcome.rolls.length)
      ];
    }
    case "keno": {
      const [only] = outcome.draws;
      return [
        t("receipt.outcome.keno.picked", { numbers: list(outcome.pickedNumbers) }),
        only && outcome.draws.length === 1
          ? t("receipt.outcome.keno.drew", { numbers: list(only.numbers), hits: only.hits })
          : t("receipt.outcome.keno.hits", { hits: list(outcome.draws.map((draw) => draw.hits)) }),
        ...rounds(outcome.draws.filter((draw) => draw.won).length, outcome.draws.length)
      ];
    }
    case "plinko":
      return [
        t("receipt.outcome.plinko", {
          risk: t(`casino.room.selection.plinko.${outcome.risk}`),
          slots: list(outcome.rolls.map((roll) => roll.bucket))
        }),
        ...rounds(outcome.rolls.filter((roll) => roll.won).length, outcome.rolls.length)
      ];
    case "slots":
      return [
        t("receipt.outcome.slots", {
          reels: outcome.rolls
            .map((roll) =>
              list(roll.symbols.map((symbol) => t(`casino.room.selection.slots.symbols.${symbol}`)))
            )
            .join("; ")
        }),
        ...rounds(outcome.rolls.filter((roll) => roll.won).length, outcome.rolls.length)
      ];
    case "baccarat": {
      const side = (value: string) => t(`casino.room.selection.baccarat.${value}`);
      const [only] = outcome.rolls;
      return [
        t("receipt.outcome.baccarat.backed", { side: side(outcome.side) }),
        only && outcome.rolls.length === 1
          ? t("receipt.outcome.baccarat.hand", {
              winner: side(only.outcome),
              player: only.playerTotal,
              banker: only.bankerTotal
            })
          : t("receipt.outcome.baccarat.winners", {
              winners: list(outcome.rolls.map((roll) => side(roll.outcome)))
            }),
        ...rounds(outcome.rolls.filter((roll) => roll.won).length, outcome.rolls.length)
      ];
    }
    case "sic-bo": {
      const kind = t(`casino.room.selection.sicBo.kinds.${outcome.betKind}`);
      const bet =
        outcome.betKind === "small" || outcome.betKind === "big" || outcome.betKind === "anyTriple"
          ? kind
          : `${kind} ${outcome.betValue}`;
      return [
        t("receipt.outcome.sicBo.bet", { bet }),
        t("receipt.outcome.sicBo.rolled", {
          dice: outcome.rolls.map((roll) => roll.dice.join("-")).join(" / "),
          totals: list(outcome.rolls.map((roll) => roll.total))
        }),
        ...rounds(outcome.rolls.filter((roll) => roll.won).length, outcome.rolls.length)
      ];
    }
  }
}
