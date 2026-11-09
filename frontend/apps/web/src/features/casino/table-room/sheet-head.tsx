"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

export type SlipSheet = { open: boolean; toggle: () => void };

/**
 * The phone's summary line at the top of the docked sheet. Tapping it opens the whole slip or
 * receipt; it is not drawn above 720px.
 */
export function SheetHead({
  sheet,
  title,
  display,
  children
}: {
  sheet: SlipSheet;
  /** The summary in words; also the button's name. */
  title: string;
  /** The summary as printed, when it is not just the words: roulette's number balls. */
  display?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = useTranslations("casino.table.sheet");
  return (
    <button
      type="button"
      aria-expanded={sheet.open}
      aria-label={`${title}. ${sheet.open ? t("close") : t("open")}`}
      onClick={sheet.toggle}
      className="relative -mx-4 hidden w-[calc(100%+32px)] items-center gap-3 px-4 pt-[18px] pb-1.5 text-left text-ink before:absolute before:top-[7px] before:left-1/2 before:-ml-5 before:h-1 before:w-10 before:rounded-full before:bg-thermal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink max-[720px]:flex"
    >
      <b className="min-w-0 flex-auto font-semibold">{display ?? title}</b>
      {children}
    </button>
  );
}
