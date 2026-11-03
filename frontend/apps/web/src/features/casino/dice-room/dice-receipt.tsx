"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { formatList } from "../../receipt/outcome";
import { PrintedReceipt } from "../../receipt/printed-receipt";
import { exactAmount, joined, receiptFromResult } from "../../receipt/receipt";
import type { CasinoTerminalRoundResult } from "../room/resolution";
import type { GameRoom } from "../room/use-game-room";
import { diceWinRange } from "./slip-model";
import { LINE_BUTTON, LINK, MAIN_BUTTON } from "./styles";

type Tearing = "again" | "change" | null;

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
  const tReceipt = useTranslations("receipt");
  const tSlip = useTranslations("casino.dice.slip");
  const locale = useLocale();
  const [tearing, setTearing] = React.useState<Tearing>(null);
  const { assetSymbol: symbol, assetDecimals: decimals, chainId } = room;
  const outcome = room.casinoOutcome?.kind === "dice" ? room.casinoOutcome : null;
  const receipt = receiptFromResult(result, outcome, {
    chainId,
    decimals,
    gameHub: room.release?.contracts.gameHub
  });
  const direction = outcome?.direction ?? room.diceDirection;
  const line = outcome?.target ?? room.diceTarget;
  const [from, to] = diceWinRange(direction, line);
  const rolls = outcome?.rolls ?? [];
  const rolled =
    rolls.length === 0
      ? null
      : [
          tReceipt("outcome.dice.rolled", {
            rolls: formatList(
              locale,
              rolls.map((roll) => roll.value)
            )
          }),
          ...(rolls.length > 1
            ? [
                tReceipt("outcome.rounds", {
                  won: rolls.filter((roll) => roll.won).length,
                  count: rolls.length
                })
              ]
            : [])
        ].join(" ");
  const net = `${receipt.net.sign}${joined(receipt.net)}`;
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
    <PrintedReceipt
      receipt={receipt}
      symbol={symbol}
      houseEdgeRate={houseEdgeRate}
      title={tSlip("game", { from, to })}
      details={
        <>
          {rolled ? <p className="mt-1 font-semibold break-keep">{rolled}</p> : null}
          <p className="text-note text-faded">{chainName}</p>
        </>
      }
      fee={result.vrfFeeCharged == null ? undefined : exactAmount(result.vrfFeeCharged, 18)}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget || event.animationName !== "tear" || !tearing)
          return;
        finish(tearing);
      }}
      bodyClassName="motion-safe:animate-reveal"
      className={`scroll-mt-4 rounded-t-sheet px-5 pt-6 pb-10 md:px-7 md:pt-8 md:pb-11 ${
        tearing ? "motion-safe:animate-tear" : ""
      }`}
      footer={
        <>
          <p className="mt-4 text-note">
            <Link href={receipt.href} className={LINK}>
              {tReceipt("open")}
            </Link>
          </p>
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
        </>
      }
    />
  );
}
