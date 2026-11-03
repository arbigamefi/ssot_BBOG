"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { PrintedFigure } from "./printed-figure";
import { shortId, type HomeReceipt } from "./receipts";

export type PrintableReceipt = HomeReceipt & { game: string; symbol: string };

type Phase = "first" | "tearing" | "again";

const REPRINT_TIMING = { "--print-time": "1.5s", "--print-delay": "0.05s" } as React.CSSProperties;

function joined(receipt: PrintableReceipt) {
  const { sign, whole, fraction } = receipt.net;
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
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
  const lineLabel = (key: PrintableReceipt["lines"][number]["key"]) =>
    key === "houseEdge" ? t("lines.houseEdge", { rate: houseEdgeRate }) : t(`lines.${key}`);
  const proof = [
    { key: "request", value: receipt.requestId },
    { key: "hash", value: receipt.randomHash },
    { key: "settled", value: receipt.settledTx, href: receipt.settledTxHref }
  ] as const;

  return (
    <article
      aria-label={t("label", { id: receipt.betId })}
      onAnimationEnd={onAnimationEnd}
      style={phase === "again" ? REPRINT_TIMING : undefined}
      className={
        phase === "tearing"
          ? "print-sheet print-torn relative px-7 pt-8 pb-10 motion-safe:animate-tear"
          : "print-sheet print-torn relative px-7 pt-8 pb-10 motion-safe:animate-print"
      }
    >
      <header className="flex items-baseline justify-between gap-3 text-note text-faded">
        <b className="font-semibold text-ink">ArbiGameFi</b>
        <span>{t("bet", { id: receipt.betId })}</span>
      </header>
      <p className="mt-4 text-lede font-semibold">{receipt.game}</p>
      {receipt.placedBlock != null ? (
        <p className="text-note text-faded">
          {t("where", { chain: chainName, block: receipt.placedBlock.toLocaleString("en-US") })}
        </p>
      ) : null}
      <div
        aria-hidden="true"
        className="print-stamp absolute top-[60px] right-3 grid size-[76px] place-items-center text-center text-note leading-tight font-extrabold motion-safe:animate-stamp md:top-16 md:right-4 md:size-[84px]"
      >
        {receipt.stamp === "paid" ? t("stampPaid") : t("stampSettled")}
      </div>
      <hr className="my-4 border-0 border-t-2 border-dashed border-thermal" />
      <p className="text-note text-faded">{t("net")}</p>
      <p className="mt-2 text-total">
        <PrintedFigure value={receipt.net} />
        <small className="ml-2 font-text text-note font-semibold">{receipt.symbol}</small>
      </p>
      <hr className="my-4 border-0 border-t-2 border-dashed border-thermal" />
      <ul>
        {receipt.lines.map((line) => (
          <li key={line.key} className="flex items-baseline gap-2 py-1">
            <span>{lineLabel(line.key)}</span>
            <span aria-hidden="true" className="print-leader" />
            <span className="font-semibold tabular-nums">{line.amount}</span>
          </li>
        ))}
      </ul>
      <hr className="my-4 border-0 border-t-2 border-dashed border-thermal" />
      <dl className="text-note">
        {proof.map((row) =>
          row.value ? (
            <div key={row.key} className="grid grid-cols-[8em_minmax(0,1fr)] gap-2 py-1">
              <dt className="text-faded">{t(`proof.${row.key}`)}</dt>
              <dd className="font-semibold tabular-nums [overflow-wrap:anywhere]">
                {"href" in row && row.href ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
                  >
                    {shortId(row.value)}
                  </a>
                ) : (
                  shortId(row.value)
                )}
              </dd>
            </div>
          ) : null
        )}
      </dl>
      <p className="mt-4 text-note">
        <Link
          href={receipt.href}
          className="font-semibold underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
        >
          {t("open")}
        </Link>
      </p>
    </article>
  );
}
