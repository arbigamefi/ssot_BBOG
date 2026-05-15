"use client";

import * as React from "react";
import Link from "next/link";

import { ArbiGameFiBrand } from "./ArbiGameFiBrand";

const GAME_LINKS = [
  { href: "/casino/dice", label: "Dice" },
  { href: "/casino/coin-toss", label: "Coin Toss" },
  { href: "/casino/roulette", label: "Roulette" },
  { href: "/casino/keno", label: "Keno" }
] as const;

const PLATFORM_LINKS = [
  { href: "/earn", label: "Earn" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/portfolio/activity", label: "Bets" }
] as const;

const RESOURCE_LINKS = [
  { href: "/portfolio", label: "Account" },
  { href: "/portfolio/claims", label: "Claims" },
  { href: "/ops", label: "Ops" }
] as const;

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/disclaimer", label: "Disclaimer" }
] as const;

const COMMUNITY_LINKS = [
  { href: "https://github.com/arbigamefi/ssot_BBOG", label: "GitHub" },
  { href: "https://github.com/arbigamefi/ssot_BBOG/tree/master/docs", label: "Docs" }
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
  return (
    <footer className="mt-16 border-t border-border bg-surface-0">
      <div className="mx-auto max-w-[1480px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-5">
            <ArbiGameFiBrand accent="cyan" subtitle="Wallet-native rooms" />
            <p className="max-w-sm text-sm leading-7 text-fg-muted">
              Wallet-native game rooms, readable settlement, and visible bankroll context on top of
              on-chain execution.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Live rooms
            </div>
          </div>

          <FooterColumn title="Games" links={GAME_LINKS} />
          <FooterColumn title="Platform" links={PLATFORM_LINKS} />
          <FooterColumn title="Resources" links={RESOURCE_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-sm text-fg-subtle md:flex-row md:items-center md:justify-between">
          <p>ArbiGameFi frontend for wallet-native rooms and transparent settlement.</p>
          <div className="flex flex-wrap items-center gap-4">
            {COMMUNITY_LINKS.map((link) => (
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
