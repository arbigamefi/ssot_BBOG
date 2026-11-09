"use client";

import * as React from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { BetRow } from "@ssot/ssot/indexer";

import { PrintedFigure } from "../../home/printed-figure";
import { buildHomeReceipt } from "../../home/receipts";
import { readCasinoOutcome } from "../room/outcome";
import type { GameRoom } from "../room/use-game-room";
import { formatRolls } from "./dice-receipt";
import { diceWinRange } from "./slip-model";
import { FOCUS_ON_PAPER, LINK } from "./styles";

/** Every section sits on one 12-column grid inside the page width. */
const SECTION_GRID =
  "mx-auto box-content grid max-w-page grid-cols-1 gap-x-columns px-gutter lg:grid-cols-12";
const HEADING = "text-heading font-extrabold text-balance break-keep";

/** How many settled dice bets the room lists. */
const STUB_COUNT = 4;

function SectionHead({ id, title, lede }: { id: string; title: string; lede: string }) {
  return (
    <div className="mb-head lg:col-span-7">
      <h2 id={id} className={HEADING}>
        {title}
      </h2>
      <p className="mt-4 max-w-[34em] text-lede text-faded">{lede}</p>
    </div>
  );
}

/**
 * The latest settled dice bets as ticket stubs, wins and losses alike. Each stub opens its public
 * receipt; its line and rolls are read from the game once and kept.
 */
export function DiceReceipts({
  room,
  rows,
  status,
  testnet,
  chainName
}: {
  room: GameRoom;
  rows: readonly BetRow[];
  status: "loading" | "error" | "ready";
  testnet: boolean;
  chainName: string;
}) {
  const t = useTranslations("casino.dice.receipts");
  const locale = useLocale();
  const { chainId, assetDecimals: decimals } = room;
  const gameHub = room.sdk?.gameHub;
  const stubs = React.useMemo(() => {
    const printed = [];
    for (const row of rows) {
      const receipt = buildHomeReceipt(row, { chainId, decimals });
      if (receipt) printed.push({ row, receipt });
      if (printed.length === STUB_COUNT) break;
    }
    return printed;
  }, [chainId, decimals, rows]);
  const outcomes = useQueries({
    queries: stubs.map(({ row }) => ({
      queryKey: ["casino", "dice", "outcome", chainId, row.gameHub, row.betId],
      enabled: Boolean(gameHub),
      staleTime: Infinity,
      retry: 1,
      queryFn: async () => {
        const bet = await gameHub!.getBet(BigInt(row.betId));
        const outcome = await readCasinoOutcome({ gameHub, bet, gameSlug: "dice" });
        return outcome?.kind === "dice" ? outcome : null;
      }
    }))
  });
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });

  return (
    <section aria-labelledby="dice-receipts-title" className="bg-paper py-section text-carbon">
      <div className={SECTION_GRID}>
        <SectionHead
          id="dice-receipts-title"
          title={t("title")}
          lede={testnet ? t("ledeTestnet", { chain: chainName }) : t("lede")}
        />
        {stubs.length === 0 ? (
          <p role="status" className="text-faded lg:col-span-8">
            {status === "loading" ? t("loading") : status === "error" ? t("error") : t("empty")}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-columns lg:col-span-12 lg:grid-cols-2">
            {stubs.map(({ row, receipt }, index) => {
              const outcome = outcomes[index]?.data;
              const placed = row.placedAt ? date.format(new Date(row.placedAt * 1000)) : "";
              let desc = placed;
              if (outcome) {
                const [from, to] = diceWinRange(outcome.direction, outcome.target);
                const rolls = formatRolls(
                  locale,
                  outcome.rolls.map((roll) => roll.value)
                );
                desc = t("desc", { from, to, count: outcome.rolls.length, rolls, date: placed });
              }
              return (
                <li key={receipt.betId}>
                  <Link
                    href={receipt.href}
                    className="group grid min-h-26 grid-cols-[minmax(0,1fr)_160px] rounded-sheet border border-(--stub-edge) text-ink [--stub-edge:hsl(var(--thermal))] hover:[--stub-edge:hsl(var(--ink))] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:min-h-28 md:grid-cols-[minmax(0,1fr)_184px]"
                  >
                    <span className="flex flex-col justify-center gap-1 px-5 py-4 md:px-6 md:py-5">
                      <span className="text-lede font-semibold decoration-1 underline-offset-4 group-hover:underline">
                        {t("bet", { id: receipt.betId })}
                      </span>
                      <span className="text-note text-faded">{desc}</span>
                    </span>
                    <span className="print-perforation flex flex-col items-center justify-center gap-1">
                      <small className="text-note leading-tight text-faded">{t("net")}</small>
                      <PrintedFigure value={receipt.net} className="text-price" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export type DiceRuleFigures = {
  houseEdgeRate: string;
  paysAtHalf: string;
  minStake: string;
  maxRounds: string;
  feeBudget: string;
  refundWait: string;
  contractHref?: string;
};

/** What the dice contract does, line by line, with today's figures. */
export function DiceRules({ figures, symbol }: { figures: DiceRuleFigures; symbol: string }) {
  const t = useTranslations("casino.dice.rules");
  const rows = ["roll", "line", "payout", "limits", "fees", "refund"] as const;
  return (
    <section aria-labelledby="dice-rules-title" className="bg-paper pb-section text-carbon">
      <div className={SECTION_GRID}>
        <SectionHead id="dice-rules-title" title={t("title")} lede={t("lede")} />
        <ul className="border-b border-thermal lg:col-span-12">
          {rows.map((key) => (
            <li
              key={key}
              className="grid grid-cols-1 items-baseline gap-x-columns gap-y-1 border-t border-thermal py-6 lg:grid-cols-12"
            >
              <h3 className="text-lede font-semibold lg:col-span-4">{t(`${key}.title`)}</h3>
              <p className="text-faded lg:col-span-5">
                {t(`${key}.body`, {
                  rate: figures.houseEdgeRate,
                  pays: figures.paysAtHalf,
                  min: figures.minStake,
                  rounds: figures.maxRounds,
                  fee: figures.feeBudget,
                  wait: figures.refundWait,
                  symbol
                })}
              </p>
              {key === "roll" && figures.contractHref ? (
                <a
                  href={figures.contractHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`text-ink lg:col-span-3 lg:justify-self-end ${LINK} ${FOCUS_ON_PAPER}`}
                >
                  {t("contract")}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
