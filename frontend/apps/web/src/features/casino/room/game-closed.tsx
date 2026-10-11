import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** A disabled game takes no new bets for good; its accepted bets still settle (ADR-0037 §6). */
export function GameClosedState({ gameName }: { gameName: string }) {
  const t = useTranslations("casino.room.closed");
  return (
    <section
      className="mx-auto w-full max-w-xl rounded-lg border border-border-soft bg-surface-1 p-6 shadow-e2"
      data-testid="game-closed"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">{gameName}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-fg">{t("title")}</h1>
      <p className="mt-3 text-sm leading-6 text-fg-muted">{t("body")}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link
          href="/portfolio/activity"
          className="flex min-h-11 items-center justify-center rounded-md border border-brand/40 bg-brand px-4 text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e1 transition-colors hover:bg-brand-hover"
        >
          {t("viewBets")}
        </Link>
        <Link
          href="/casino"
          className="flex min-h-11 items-center justify-center rounded-md border border-border-soft bg-surface-2 px-4 text-xs font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
        >
          {t("browse")}
        </Link>
      </div>
    </section>
  );
}
