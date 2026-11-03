import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { PrintedFigure } from "./printed-figure";
import { shortId, type Receipt } from "./receipt";

export const RECEIPT_LINK =
  "font-semibold underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";
const DIVIDER = "my-4 border-0 border-t-2 border-dashed border-thermal";

export type ReceiptProofRow = {
  key: string;
  label: string;
  value: string;
  href?: string;
  /** An id or hash, shortened to its ends. */
  short?: boolean;
};

/**
 * The printed receipt (docs/design/04-page-blueprints.md §1): the stamp, the net result in Doto,
 * every amount exact on a dotted leader, and under a tear line the proof. The randomness fee is
 * paid in ETH, so it sits with the proof and is never added to the asset's lines. A finished
 * receipt has a torn lower edge; the caller sets its motion and padding.
 */
export function PrintedReceipt({
  receipt,
  symbol,
  houseEdgeRate,
  title,
  details,
  fee,
  proof = [],
  footer,
  className,
  bodyClassName,
  style,
  onAnimationEnd,
  children
}: {
  receipt: Receipt;
  symbol: string;
  /** The house edge's rate, as the reader's locale writes a percentage. */
  houseEdgeRate: string;
  /** The game, or the bet's line. */
  title: React.ReactNode;
  /** Sentences under the title: what the game drew, where the bet was placed. */
  details?: React.ReactNode;
  /** The randomness fee charged, exact, in ETH; null prints a dash, undefined leaves the row out. */
  fee?: string | null;
  /** More proof rows after the transaction and the fee. */
  proof?: readonly ReceiptProofRow[];
  /** Under the proof: links and buttons. */
  footer?: React.ReactNode;
  className?: string;
  /** Everything under the title, so a receipt being printed can reveal it line by line. */
  bodyClassName?: string;
  style?: React.CSSProperties;
  onAnimationEnd?: React.AnimationEventHandler<HTMLElement>;
  /** Between the lines and the proof: what the reader can do about a held or claimable amount. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("receipt");
  const lineLabel = (key: Receipt["lines"][number]["key"]) =>
    key === "houseEdge" ? t("lines.houseEdge", { rate: houseEdgeRate }) : t(`lines.${key}`);
  const note = receipt.owed
    ? t("notes.owed")
    : receipt.stamp === "voided"
      ? t("notes.voided")
      : receipt.stamp === "refunded"
        ? t("notes.refunded")
        : null;
  const rows: ReceiptProofRow[] = [
    ...(receipt.requestId
      ? [{ key: "request", label: t("proof.request"), value: receipt.requestId, short: true }]
      : []),
    ...(receipt.randomHash
      ? [{ key: "hash", label: t("proof.hash"), value: receipt.randomHash, short: true }]
      : []),
    ...(receipt.settledTx
      ? [
          {
            key: "settled",
            label: t(`proof.${receipt.stamp === "paid" ? "settled" : receipt.stamp}`),
            value: receipt.settledTx,
            href: receipt.settledTxHref,
            short: true
          }
        ]
      : []),
    ...proof
  ];

  return (
    <article
      aria-label={t("label", { id: receipt.betId })}
      onAnimationEnd={onAnimationEnd}
      style={style}
      className={cn("print-sheet print-torn relative", className)}
    >
      <header className="flex items-baseline justify-between gap-3 text-note text-faded">
        <b className="font-semibold text-ink">ArbiGameFi</b>
        <span>{t("bet", { id: receipt.betId })}</span>
      </header>
      <p className="mt-4 pr-20 text-lede font-semibold">{title}</p>
      {details ? <div className="pr-20">{details}</div> : null}
      <div
        aria-hidden="true"
        className="print-stamp absolute top-[60px] right-3 grid size-[76px] place-items-center text-center text-note leading-tight font-extrabold motion-safe:animate-stamp md:top-16 md:right-4 md:size-[84px]"
      >
        {t(`stamp.${receipt.stamp}`)}
      </div>
      <div className={bodyClassName}>
        <hr className={DIVIDER} />
        <p className="text-note text-faded">{t("net")}</p>
        <p className="mt-2 text-total">
          <PrintedFigure value={receipt.net} />
          <small className="ml-2 font-text text-note font-semibold">{symbol}</small>
        </p>
        <hr className={DIVIDER} />
        <ul>
          {receipt.lines.map((line) => (
            <li key={line.key} className="flex items-baseline gap-2 py-1">
              <span>{lineLabel(line.key)}</span>
              <span aria-hidden="true" className="print-leader" />
              <span className="font-semibold tabular-nums">{line.amount}</span>
            </li>
          ))}
        </ul>
        {note ? <p className="mt-2 text-note">{note}</p> : null}
        {children}
        <hr className={DIVIDER} />
        <dl className="text-note">
          {rows.map(({ key, ...row }) => (
            <ProofRow key={key} {...row} />
          ))}
          {fee === undefined ? null : (
            <ProofRow
              label={t("proof.fee")}
              value={fee === null ? "—" : t("proof.feeValue", { amount: fee })}
            />
          )}
        </dl>
      </div>
      {footer}
    </article>
  );
}

function ProofRow({ label, value, href, short }: Omit<ReceiptProofRow, "key">) {
  const shown = short ? shortId(value) : value;
  return (
    <div className="grid grid-cols-[8em_minmax(0,1fr)] gap-2 py-1">
      <dt className="text-faded">{label}</dt>
      <dd className="font-semibold tabular-nums [overflow-wrap:anywhere]">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className={RECEIPT_LINK}>
            {shown}
          </a>
        ) : (
          shown
        )}
      </dd>
    </div>
  );
}
