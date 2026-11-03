"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { getExplorerTxUrl } from "../../../app-shell/chain-registry";
import { PrintedFigure } from "../../home/printed-figure";
import { joined, shortId } from "../../home/receipts";
import type { CasinoTerminalRoundResult } from "../room/resolution";
import type { GameRoom } from "../room/use-game-room";
import { buildSlipReceipt, diceWinRange } from "./slip-model";
import { DIVIDER, LINE_BUTTON, LINK, MAIN_BUTTON } from "./styles";

type Tearing = "again" | "change" | null;

/** The rolls of a dice bet as a list in the reader's language: "66, 45, 30, 48 and 20". */
export function formatRolls(locale: string, rolls: readonly number[]) {
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(rolls.map(String));
}

/**
 * The settled slip: the rolls, the stamp and the exact amounts, torn off along its lower edge.
 * "Bet again" and "Change bet" tear it away; the receipt stays on its public page.
 */
export function DiceReceipt({
  room,
  result,
  chainName,
  houseEdgeRate,
  onAnnounce
}: {
  room: GameRoom;
  result: CasinoTerminalRoundResult;
  chainName: string;
  houseEdgeRate: string;
  /** Says the result once, in the room's live region. */
  onAnnounce: (text: string) => void;
}) {
  const t = useTranslations("casino.dice.receipt");
  const tSlip = useTranslations("casino.dice.slip");
  const locale = useLocale();
  const [tearing, setTearing] = React.useState<Tearing>(null);
  const { assetSymbol: symbol, assetDecimals: decimals, chainId } = room;
  const outcome = room.casinoOutcome?.kind === "dice" ? room.casinoOutcome : null;
  const receipt = buildSlipReceipt(result, outcome, decimals);
  const direction = outcome?.direction ?? room.diceDirection;
  const line = outcome?.target ?? room.diceTarget;
  const [from, to] = diceWinRange(direction, line);
  const rolls = outcome?.rolls ?? [];
  const won = rolls.filter((roll) => roll.won).length;
  const rolled =
    rolls.length === 0
      ? null
      : rolls.length > 1
        ? t("rolledRounds", {
            rolls: formatRolls(
              locale,
              rolls.map((roll) => roll.value)
            ),
            won,
            count: rolls.length
          })
        : t("rolled", { rolls: String(rolls[0]!.value) });
  const net = `${receipt.net.sign}${joined(receipt.net)}`;
  const lineLabel = (key: (typeof receipt.lines)[number]["key"]) =>
    key === "houseEdge" ? t("lines.houseEdge", { rate: houseEdgeRate }) : t(`lines.${key}`);
  const settledHref =
    (receipt.settledTx && getExplorerTxUrl(chainId, receipt.settledTx)) || undefined;

  const announcement = t("announce", { rolled: rolled ?? "", net, symbol });
  React.useEffect(() => onAnnounce(announcement), [announcement, onAnnounce]);

  const finish = (how: Exclude<Tearing, null>) => {
    if (how === "again") room.handleResultPlayAgain();
    else room.handleResultClose();
  };
  const tear = (how: Exclude<Tearing, null>) => {
    if (tearing) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true) {
      finish(how);
      return;
    }
    setTearing(how);
  };

  return (
    <article
      aria-label={t("label", { id: receipt.betId })}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget || event.animationName !== "tear" || !tearing)
          return;
        finish(tearing);
      }}
      className={`print-sheet print-torn relative scroll-mt-4 rounded-t-sheet px-5 pt-6 pb-10 md:px-7 md:pt-8 md:pb-11 ${
        tearing ? "motion-safe:animate-tear" : ""
      }`}
    >
      <header className="flex items-baseline justify-between gap-3 text-note text-faded">
        <b className="font-semibold text-ink">ArbiGameFi</b>
        <span>{t("bet", { id: receipt.betId })}</span>
      </header>
      <p className="mt-4 pr-20 text-lede font-semibold">{tSlip("game", { from, to })}</p>
      {rolled ? <p className="mt-1 pr-20 font-semibold break-keep">{rolled}</p> : null}
      <p className="pr-20 text-note text-faded">{chainName}</p>
      <div
        aria-hidden="true"
        className="print-stamp absolute top-[60px] right-3 grid size-[76px] place-items-center text-center text-note leading-tight font-extrabold motion-safe:animate-stamp md:top-16 md:right-4 md:size-[84px]"
      >
        {t(`stamp.${receipt.stamp}`)}
      </div>
      <div className="motion-safe:animate-reveal">
        <hr className={DIVIDER} />
        <p className="text-note text-faded">{t("net")}</p>
        <p className="mt-2 text-total">
          <PrintedFigure value={receipt.net} />
          <small className="ml-2 font-text text-note font-semibold">{symbol}</small>
        </p>
        <hr className={DIVIDER} />
        <ul>
          {receipt.lines.map((row) => (
            <li key={row.key} className="flex items-baseline gap-2 py-1">
              <span>{lineLabel(row.key)}</span>
              <span aria-hidden="true" className="print-leader" />
              <span className="font-semibold tabular-nums">{row.amount}</span>
            </li>
          ))}
        </ul>
        {receipt.owed ? <p className="mt-2 text-note">{t("owedNote")}</p> : null}
        <hr className={DIVIDER} />
        <dl className="text-note">
          <ProofRow label={t("proof.request")} value={receipt.requestId} />
          <ProofRow label={t("proof.hash")} value={receipt.randomHash} />
          {receipt.settledTx ? (
            <ProofRow label={t("proof.settled")} value={receipt.settledTx} href={settledHref} />
          ) : null}
        </dl>
        <p className="mt-4 text-note">
          <Link href={`/casino/receipt/${chainId}/${receipt.betId}`} className={LINK}>
            {t("open")}
          </Link>
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => tear("again")} className={MAIN_BUTTON}>
          <b className="font-semibold">{t("again")}</b>
        </button>
        <button
          type="button"
          onClick={() => tear("change")}
          className={`${LINE_BUTTON} min-h-14 rounded-sheet text-body`}
        >
          {t("change")}
        </button>
      </div>
    </article>
  );
}

function ProofRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="grid grid-cols-[8em_minmax(0,1fr)] gap-2 py-1">
      <dt className="text-faded">{label}</dt>
      <dd className="font-semibold tabular-nums [overflow-wrap:anywhere]">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className={LINK}>
            {shortId(value)}
          </a>
        ) : (
          shortId(value)
        )}
      </dd>
    </div>
  );
}
