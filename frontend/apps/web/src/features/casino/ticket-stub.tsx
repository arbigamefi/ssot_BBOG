import * as React from "react";
import Link from "next/link";

import { PrintedFigure } from "../home/printed-figure";
import type { SignedAmount } from "../home/receipts";

/** The perforated part is wider when it prints an amount rather than a multiplier. */
const STUB_COLUMNS = {
  multiplier: "grid-cols-[minmax(0,1fr)_128px] md:grid-cols-[minmax(0,1fr)_152px]",
  amount: "grid-cols-[minmax(0,1fr)_160px] md:grid-cols-[minmax(0,1fr)_184px]"
} as const;

/**
 * A ticket stub: a printed object with what it is on the left and, past the perforation, one
 * figure in Doto. The whole stub is the link.
 */
export function TicketStub({
  href,
  title,
  detail,
  label,
  value,
  suffix,
  figure = "multiplier"
}: {
  href: string;
  title: string;
  detail: React.ReactNode;
  label: string;
  value: SignedAmount;
  suffix?: string;
  figure?: keyof typeof STUB_COLUMNS;
}) {
  return (
    <Link
      href={href}
      className={`group grid min-h-26 ${STUB_COLUMNS[figure]} rounded-sheet border border-(--stub-edge) text-ink [--stub-edge:hsl(var(--thermal))] hover:[--stub-edge:hsl(var(--ink))] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:min-h-28`}
    >
      <span className="flex flex-col justify-center gap-1 px-5 py-4 md:px-6 md:py-5">
        <span className="text-lede font-semibold decoration-1 underline-offset-4 group-hover:underline">
          {title}
        </span>
        <span className="text-note text-faded">{detail}</span>
      </span>
      <span className="print-perforation flex flex-col items-center justify-center gap-1">
        <small className="text-note leading-tight text-faded">{label}</small>
        <PrintedFigure value={value} suffix={suffix} className="text-price" />
      </span>
    </Link>
  );
}
