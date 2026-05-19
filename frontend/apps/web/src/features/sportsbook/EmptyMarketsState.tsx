import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * EmptyMarketsState — the pre-launch / no-markets surface for /sportsbook.
 *
 * Two variants:
 * - `preview`  — the sportsbook feature flag is off; explain the launch state
 *   in calm copy and give a link back to ops or to the casino product so the
 *   visitor doesn't bounce.
 * - `quiet`    — markets exist on the contract but none are live or upcoming
 *   in the current view; suggest filters or coming events.
 *
 * No marketing fluff, no countdowns, no fake market tiles.
 */
export function EmptyMarketsState({
  variant,
  reason
}: {
  variant: "preview" | "quiet";
  reason?: string;
}) {
  const t = useTranslations("sportsbook.player.empty");
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-1 px-6 py-12 md:py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-fg-muted">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4 w-4"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 className="text-lg font-semibold text-fg">{t(`${variant}.title`)}</h2>
        <p className="max-w-prose text-sm leading-6 text-fg-muted">
          {reason ?? t(`${variant}.description`)}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/casino"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface-2 px-3 text-sm font-medium text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
          >
            {t("ctaCasino")}
          </Link>
          <Link
            href="/ops/sportsbook"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface-2 px-3 text-sm font-medium text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
          >
            {t("ctaOps")}
          </Link>
        </div>
      </div>
    </div>
  );
}
