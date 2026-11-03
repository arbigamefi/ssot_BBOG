"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { PrintedReceipt, RECEIPT_LINK } from "../receipt/printed-receipt";
import { joined as joinedAmount, type Receipt as PrintedData } from "../receipt/receipt";

export type PrintableReceipt = PrintedData & { game: string; symbol: string };

type Phase = "first" | "tearing" | "again";

const REPRINT_TIMING = { "--print-time": "1.5s", "--print-delay": "0.05s" } as React.CSSProperties;

function joined(receipt: PrintableReceipt) {
  return `${receipt.net.sign}${joinedAmount(receipt.net)}`;
}

/**
 * The hero's receipt printer. It prints the latest settled bets, wins and losses alike;
 * "Print another" tears the receipt off and prints the next one. With reduced motion the
 * next receipt replaces it in place.
 */
export function ReceiptPrinter({
  receipts,
  status,
  chainName,
  houseEdgeRate,
  caption
}: {
  receipts: readonly PrintableReceipt[];
  status: "loading" | "error" | "ready";
  chainName: string;
  houseEdgeRate: string;
  caption: string;
}) {
  const t = useTranslations("home.receipt");
  const [shownId, setShownId] = React.useState<string>();
  const [phase, setPhase] = React.useState<Phase>("first");
  const [announcement, setAnnouncement] = React.useState("");
  // The list refreshes every few seconds; keep the receipt on show until the visitor asks.
  const shownIndex = Math.max(
    0,
    receipts.findIndex((receipt) => receipt.betId === shownId)
  );
  const receipt = receipts[shownIndex];

  const printNext = () => {
    const next = receipts[(shownIndex + 1) % receipts.length];
    if (!next) return;
    setShownId(next.betId);
    setAnnouncement(
      t("announce", { id: next.betId, game: next.game, net: joined(next), symbol: next.symbol })
    );
  };

  const reprint = () => {
    if (phase === "tearing") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true) {
      printNext();
      return;
    }
    setPhase("tearing");
  };

  const onAnimationEnd = (event: React.AnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.animationName !== "tear") return;
    printNext();
    setPhase("again");
  };

  return (
    <figure aria-labelledby="home-receipt-caption" className="w-full">
      <div aria-hidden="true" className="print-slot relative z-10 h-4" />
      <div className="-mt-2 mx-4 overflow-hidden pb-6">
        {receipt ? (
          <Receipt
            key={receipt.betId}
            receipt={receipt}
            chainName={chainName}
            houseEdgeRate={houseEdgeRate}
            phase={phase}
            onAnimationEnd={onAnimationEnd}
          />
        ) : (
          <p role="status" className="pt-8 text-note text-on-carbon-muted">
            {status === "loading" ? t("loading") : status === "error" ? t("error") : t("empty")}
          </p>
        )}
      </div>
      <div className="mx-4 flex flex-wrap items-center gap-x-6 gap-y-4">
        {receipts.length > 1 ? (
          <button
            type="button"
            onClick={reprint}
            className="min-h-12 rounded-sheet border border-current px-5 font-semibold whitespace-nowrap text-paper hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-paper"
          >
            {t("reprint")}
          </button>
        ) : null}
        <figcaption
          id="home-receipt-caption"
          className="min-w-0 flex-[1_1_14em] text-note text-on-carbon-muted"
        >
          {caption}
        </figcaption>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </figure>
  );
}

function Receipt({
  receipt,
  chainName,
  houseEdgeRate,
  phase,
  onAnimationEnd
}: {
  receipt: PrintableReceipt;
  chainName: string;
  houseEdgeRate: string;
  phase: Phase;
  onAnimationEnd: (event: React.AnimationEvent<HTMLElement>) => void;
}) {
  const t = useTranslations("home.receipt");
  const tReceipt = useTranslations("receipt");

  return (
    <PrintedReceipt
      receipt={receipt}
      symbol={receipt.symbol}
      houseEdgeRate={houseEdgeRate}
      title={receipt.game}
      details={
        receipt.placedBlock != null ? (
          <p className="text-note text-faded">
            {tReceipt("where", {
              chain: chainName,
              block: receipt.placedBlock.toLocaleString("en-US")
            })}
          </p>
        ) : null
      }
      onAnimationEnd={onAnimationEnd}
      style={phase === "again" ? REPRINT_TIMING : undefined}
      className={
        phase === "tearing"
          ? "px-7 pt-8 pb-10 motion-safe:animate-tear"
          : "px-7 pt-8 pb-10 motion-safe:animate-print"
      }
      footer={
        <p className="mt-4 text-note">
          <Link href={receipt.href} className={RECEIPT_LINK}>
            {tReceipt("open")}
          </Link>
        </p>
      }
    />
  );
}
