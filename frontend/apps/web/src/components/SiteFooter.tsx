"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ArbiGameFiBrand } from "./ArbiGameFiBrand";
import { LocaleSwitcher } from "./LocaleSwitcher";

const GAME_LINKS = [
  { href: "/casino/dice", labelKey: "nav.dice" },
  { href: "/casino/coin-toss", labelKey: "nav.coinToss" },
  { href: "/casino/roulette", labelKey: "nav.roulette" },
  { href: "/casino/keno", labelKey: "nav.keno" }
] as const;

const PLATFORM_LINKS = [
  { href: "/earn", labelKey: "footer.earn" },
  { href: "/portfolio", labelKey: "footer.portfolio" },
  { href: "/portfolio/activity", labelKey: "nav.bets" }
] as const;

const RESOURCE_LINKS = [
  { href: "/portfolio", labelKey: "nav.account" },
  { href: "/portfolio/claims", labelKey: "nav.claims" },
  { href: "/ops", labelKey: "nav.ops" }
] as const;

const LEGAL_LINKS = [
  { href: "/legal/terms", labelKey: "footer.terms" },
  { href: "/legal/privacy", labelKey: "footer.privacy" },
  { href: "/legal/disclaimer", labelKey: "footer.disclaimer" }
] as const;

const COMMUNITY_LINKS = [
  { href: "https://github.com/arbigamefi/ssot_BBOG", labelKey: "GitHub" },
  { href: "https://github.com/arbigamefi/ssot_BBOG/tree/master/docs", labelKey: "footer.docs" }
] as const;

function FooterColumn({
  title,
  links
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-fg-subtle">{title}</h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-fg-muted transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const t = useTranslations();
  const translateLinks = (links: ReadonlyArray<{ href: string; labelKey: string }>) =>
    links.map((link) => ({
      href: link.href,
      label: link.labelKey === "GitHub" ? "GitHub" : t(link.labelKey)
    }));

  return (
    <footer className="mt-16 border-t border-border bg-surface-0">
      <div className="mx-auto max-w-[1480px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-5">
            <ArbiGameFiBrand accent="cyan" subtitle={t("footer.brandSubtitle")} />
            <p className="max-w-sm text-sm leading-7 text-fg-muted">{t("footer.description")}</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {t("footer.liveRooms")}
            </div>
          </div>

          <FooterColumn title={t("footer.games")} links={translateLinks(GAME_LINKS)} />
          <FooterColumn title={t("footer.platform")} links={translateLinks(PLATFORM_LINKS)} />
          <FooterColumn title={t("footer.resources")} links={translateLinks(RESOURCE_LINKS)} />
          <FooterColumn title={t("footer.legal")} links={translateLinks(LEGAL_LINKS)} />
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-sm text-fg-subtle md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <p>{t("footer.copyright")}</p>
            <LocaleSwitcher />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {translateLinks(COMMUNITY_LINKS).map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-fg"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
