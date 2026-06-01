"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NoSymbolIcon } from "@heroicons/react/24/outline";

import { useCompliance } from "./ComplianceProvider";
import { isWagerRoute } from "./wager-routes";

/**
 * Hard route-level block for self-excluded players. Rather than threading a
 * guard through every bet entry point, we intercept the wager-bearing routes
 * (shared `isWagerRoute` definition) and replace their content with a block
 * screen until the exclusion window elapses. Browsing marketing / legal /
 * portfolio stays allowed so the player can still review history and find help.
 */
export function SelfExclusionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("compliance.selfExcludedGate");
  const { hydrated, isSelfExcluded, selfExcludedUntil } = useCompliance();

  if (!hydrated || !isSelfExcluded || !isWagerRoute(pathname)) {
    return <>{children}</>;
  }

  const until = selfExcludedUntil ? new Date(selfExcludedUntil).toLocaleString() : "";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-danger/40 bg-danger-soft text-danger">
        <NoSymbolIcon className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-bold text-fg">{t("title")}</h1>
      <p className="max-w-md text-sm leading-6 text-fg-muted">{t("description", { until })}</p>
      <div className="flex gap-3">
        <Link
          href="/portfolio/activity"
          className="rounded-md border border-border-soft bg-surface-2 px-5 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-3"
        >
          {t("viewHistory")}
        </Link>
        <Link
          href="/legal/disclaimer"
          className="rounded-md border border-border-soft bg-surface-2 px-5 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-3"
        >
          {t("getHelp")}
        </Link>
      </div>
    </div>
  );
}
