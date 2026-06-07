"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { useCompliance } from "./ComplianceProvider";
import { overlayZ, stickyActionHeightVar } from "../../components/overlay/z";

/**
 * GDPR / CCPA cookie consent. Shown only after the age/terms gate clears,
 * and only until the visitor makes a choice. Analytics stays dark until
 * consent is "accepted" (wired in AnalyticsProvider via useCompliance).
 */
export function CookieConsentBanner() {
  const t = useTranslations("compliance.cookies");
  const { hydrated, entryCleared, cookieConsent, setCookieConsent } = useCompliance();

  if (!hydrated || !entryCleared || cookieConsent !== null) return null;

  return (
    <div
      role="region"
      aria-label={t("title")}
      className={cn(
        "fixed inset-x-0 border-t border-border-soft bg-surface-1/95 px-4 py-4 shadow-e3 backdrop-blur",
        overlayZ.bottomBanner
      )}
      // Sit above the mobile sticky bet/connect CTA when one is mounted; clear
      // the home-indicator safe area otherwise.
      style={{ bottom: `var(${stickyActionHeightVar}, env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs leading-5 text-fg-muted md:max-w-2xl">
          {t("description")}{" "}
          <Link
            href="/legal/privacy"
            className="font-semibold text-brand underline-offset-2 hover:underline"
          >
            {t("learnMore")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setCookieConsent("rejected")}
            className="rounded-md border border-border-soft bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-fg-muted transition hover:text-fg"
          >
            {t("reject")}
          </button>
          <button
            type="button"
            onClick={() => setCookieConsent("accepted")}
            className="rounded-md bg-brand px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse transition hover:bg-brand-hover"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
