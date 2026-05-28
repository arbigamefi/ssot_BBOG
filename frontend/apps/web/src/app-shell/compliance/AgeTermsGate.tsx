"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

import { useCompliance } from "./ComplianceProvider";
import { isWagerRoute } from "./wager-routes";
import { useFocusTrap } from "../a11y/useFocusTrap";

/**
 * Entry gate for wager routes. Renders a non-dismissable overlay until the
 * visitor confirms age + jurisdiction responsibility + accepts the current
 * Terms — but ONLY on wager-bearing routes (casino / sportsbook). Marketing,
 * legal, support, and status pages are intentionally never gated, so:
 *   1. visitors can read the Terms/Privacy they must accept (no catch-22), and
 *   2. the public landing pages stay open for SEO and conversion.
 *
 * Acceptance is a one-time, device-wide flag, so once cleared the gate never
 * shows again on any route.
 */
export function AgeTermsGate() {
  const t = useTranslations("compliance.gate");
  const pathname = usePathname();
  const { hydrated, entryCleared, confirmAgeAndTerms } = useCompliance();

  const [ageChecked, setAgeChecked] = React.useState(false);
  const [jurisdictionChecked, setJurisdictionChecked] = React.useState(false);
  const [termsChecked, setTermsChecked] = React.useState(false);

  const blocking = hydrated && !entryCleared && isWagerRoute(pathname);
  const trapRef = useFocusTrap<HTMLDivElement>(blocking);

  // Avoid SSR/client flash — only decide after hydration reads storage, and
  // only on the routes that actually require clearance.
  if (!blocking) return null;

  const allChecked = ageChecked && jurisdictionChecked && termsChecked;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-0/95 px-4 backdrop-blur-md"
    >
      <div
        ref={trapRef}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-soft bg-surface-1 shadow-e3"
      >
        <div
          className="flex items-center gap-3 border-b border-border-soft px-6 py-5"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
          }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/30 bg-brand-soft text-brand">
            <ShieldCheckIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 id="age-gate-title" className="text-lg font-bold text-fg">
              {t("title")}
            </h2>
            <p className="text-xs text-fg-muted">{t("subtitle")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-6 py-5">
          <GateCheckbox checked={ageChecked} onChange={setAgeChecked} label={t("age")} />
          <GateCheckbox
            checked={jurisdictionChecked}
            onChange={setJurisdictionChecked}
            label={t("jurisdiction")}
          />
          <GateCheckbox
            checked={termsChecked}
            onChange={setTermsChecked}
            label={
              <span>
                {t("termsPrefix")}{" "}
                <Link
                  href="/legal/terms"
                  target="_blank"
                  className="font-semibold text-brand underline-offset-2 hover:underline"
                >
                  {t("termsLink")}
                </Link>{" "}
                {t("and")}{" "}
                <Link
                  href="/legal/privacy"
                  target="_blank"
                  className="font-semibold text-brand underline-offset-2 hover:underline"
                >
                  {t("privacyLink")}
                </Link>
                {t("termsSuffix")}
              </span>
            }
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border-soft px-6 py-5 sm:flex-row-reverse">
          <button
            type="button"
            disabled={!allChecked}
            onClick={confirmAgeAndTerms}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-brand px-5 py-3 text-sm font-bold text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("enter")}
          </button>
          <Link
            href="/"
            className="inline-flex flex-1 items-center justify-center rounded-md border border-border-soft bg-surface-2 px-5 py-3 text-sm font-semibold text-fg-muted transition hover:text-fg"
          >
            {t("leave")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function GateCheckbox({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-soft bg-surface-0 px-4 py-3 transition-colors hover:border-brand/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--brand))]"
      />
      <span className="text-sm leading-5 text-fg">{label}</span>
    </label>
  );
}
