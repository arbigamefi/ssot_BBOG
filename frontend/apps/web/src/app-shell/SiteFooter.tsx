"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { OFFICIAL_CHANNELS } from "../config/site";
import { useCompliance } from "./compliance";
import { FOCUS_ON_CARBON } from "./site-nav";

const LINK = `inline-flex min-h-11 items-center text-on-carbon-muted decoration-1 underline-offset-4 hover:text-paper hover:underline ${FOCUS_ON_CARBON}`;
const INLINE_LINK = `font-semibold text-paper underline decoration-1 underline-offset-4 ${FOCUS_ON_CARBON}`;

/**
 * Footer links grouped by reader (03-information-architecture.md §4). Liquidity keeps
 * its current route until that page moves.
 */
export const FOOTER_GROUPS = [
  { key: "play", links: [{ key: "casino", href: "/casino" }] },
  {
    key: "liquidity",
    links: [
      { key: "liquidity", href: "/earn" },
      { key: "status", href: "/status" }
    ]
  },
  {
    key: "help",
    links: [
      { key: "support", href: "/support" },
      { key: "terms", href: "/legal/terms" },
      { key: "privacy", href: "/legal/privacy" },
      { key: "disclaimer", href: "/legal/disclaimer" }
    ]
  }
] as const;

/** The site footer on carbon-deep: who may play, the links by reader and the official channels. */
export function SiteFooter() {
  const t = useTranslations("app.footer");
  const { openRgDialog } = useCompliance();

  return (
    <footer className="bg-carbon-deep font-text text-note text-on-carbon-muted">
      <div className="mx-auto box-content grid max-w-page grid-cols-1 gap-x-columns gap-y-10 px-gutter py-section lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-paper font-extrabold text-paper"
            >
              18+
            </span>
            <span className="sr-only">{t("ageLabel")}</span>
            <span className="font-semibold text-paper">{t("age")}</span>
          </p>
          <p className="mt-4">
            {t.rich("restricted", {
              terms: (chunks) => (
                <Link href="/legal/terms" className={INLINE_LINK}>
                  {chunks}
                </Link>
              )
            })}
          </p>
          <button
            type="button"
            onClick={openRgDialog}
            className={`mt-2 inline-flex min-h-11 items-center ${INLINE_LINK}`}
          >
            {t("responsibleGambling")}
          </button>
        </div>

        <nav
          aria-label={t("label")}
          className="grid grid-cols-2 gap-x-columns gap-y-8 sm:grid-cols-4 lg:col-span-7"
        >
          {FOOTER_GROUPS.map((group) => (
            <section key={group.key} aria-labelledby={`footer-${group.key}`}>
              <h2 id={`footer-${group.key}`} className="font-semibold text-paper">
                {t(`groups.${group.key}`)}
              </h2>
              <ul className="mt-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={LINK}>
                      {t(`links.${link.key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section aria-labelledby="footer-channels">
            <h2 id="footer-channels" className="font-semibold text-paper">
              {t("groups.channels")}
            </h2>
            <ul className="mt-2">
              <li>
                <a
                  href={OFFICIAL_CHANNELS.telegram}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={LINK}
                >
                  {t("links.telegram")}
                </a>
              </li>
              <li>
                <a
                  href={OFFICIAL_CHANNELS.x}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={LINK}
                >
                  {t("links.x")}
                </a>
              </li>
            </ul>
          </section>
        </nav>

        <div className="flex flex-col gap-2 border-t border-rule-carbon pt-6 sm:flex-row sm:items-center sm:justify-between lg:col-span-12">
          <p>{t("channelsNote")}</p>
          <Link href="/ops" className={LINK}>
            {t("links.ops")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
