"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { getExplorerTxUrl } from "../../../app-shell/chain-registry";
import { PrintedFigure } from "../../home/printed-figure";
import { joined, shortId } from "../../home/receipts";
import type { CasinoTerminalRoundResult } from "../room/resolution";
import type { GameRoom } from "../room/use-game-room";
import { SheetHead, type SlipSheet } from "./sheet-head";
import { buildSlipReceipt } from "./slip-model";
import { DIVIDER, LINE_BUTTON, LINK, MAIN_BUTTON, SHEET_FULL, SHEET_PHONE } from "./styles";

type Tearing = "again" | "change" | null;

/** The receipt's lines about the game in the room. */
export type ReceiptGame = {
  /** The bet in one line: "Dice, win on 1–50". */
  line: string;
  /** The numbers it covers, when the line does not say. */
  covers?: string;
  /** What came up, as words for the summary line and screen readers, and as print. */
  rolled: { text: string; print?: React.ReactNode } | null;
};

/** Rolls as a list in the reader's language: "66, 45, 30, 48 and 20". */
export function formatRolls(locale: string, rolls: readonly (number | string)[]) {
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(rolls.map(String));
}

/**
 * The settled slip, printed out of the slot once the ball has stopped: the rolls, the stamp and
 * the exact amounts, torn along its lower edge. "Bet again" and "Change bet" tear it away; the
 * receipt stays on its public page. A closed phone sheet shows the roll, the net result and the
 * two actions.
 */
export function RoomReceipt({
  game,
  room,
  result,
  chainName,
  houseEdgeRate,
  onAnnounce,
  sheet
}: {
  game: ReceiptGame;
  room: GameRoom;
  result: CasinoTerminalRoundResult;
  chainName: string;
  houseEdgeRate: string;
  /** Says the result once, in the room's live region. */
  onAnnounce: (text: string) => void;
  sheet: SlipSheet;
}) {
  const t = useTranslations("casino.table.receipt");
  const [tearing, setTearing] = React.useState<Tearing>(null);
  const { assetSymbol: symbol, assetDecimals: decimals, chainId } = room;
  const receipt = buildSlipReceipt(result, room.casinoOutcome, decimals);
  const rolled = game.rolled?.text ?? null;
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
      className={`print-sheet print-torn relative rounded-t-sheet px-6 pt-7 pb-10 ${SHEET_PHONE} ${
        tearing
          ? "motion-safe:animate-tear"
          : "motion-safe:animate-print [--print-delay:0s] [--print-time:1.4s] max-[720px]:animate-none"
      }`}
    >
      <SheetHead sheet={sheet} title={rolled ?? game.line} display={game.rolled?.print}>
        <PrintedFigure value={receipt.net} className="text-[22px] leading-none" />
      </SheetHead>
      <div className={SHEET_FULL}>
        <header className="flex items-baseline justify-between gap-3 text-note text-faded">
          <b className="font-semibold text-ink">ArbiGameFi</b>
          <span>{t("bet", { id: receipt.betId })}</span>
        </header>
        <p className="mt-4 pr-24 text-lede font-semibold">{game.line}</p>
        {game.covers ? <p className="mt-1 pr-24 text-note text-faded">{game.covers}</p> : null}
        {rolled ? (
          <p className="mt-1 pr-24 font-semibold break-keep">{game.rolled?.print ?? rolled}</p>
        ) : null}
        <p className="pr-24 text-note text-faded">{chainName}</p>
        <div
          aria-hidden="true"
          className="print-stamp absolute top-16 right-4 grid size-[84px] place-items-center text-center text-note leading-tight font-extrabold motion-safe:animate-stamp max-[720px]:top-[118px] max-[720px]:size-[76px] max-[720px]:[animation-delay:0.15s]"
        >
          {t(`stamp.${receipt.stamp}`)}
        </div>
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
      <div className="mt-5 grid grid-cols-2 gap-2 max-[720px]:group-data-closed/sheet:mt-2">
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
