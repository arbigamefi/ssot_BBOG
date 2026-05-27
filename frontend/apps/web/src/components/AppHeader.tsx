import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { cn } from "@ssot/ui";
import { WalletButton } from "../app-shell/WalletButton";
import { NetworkSwitcher } from "../app-shell/NetworkSwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";

export type AppRoute =
  | "directory"
  | "sportsbook"
  | "bets"
  | "liquidity"
  | "claims"
  | "referral"
  | "account"
  | "ops"
  | "none"
  | "dice"
  | "plinko"
  | "slots"
  | "baccarat"
  | "sicbo"
  | "roulette"
  | "cointoss"
  | "keno";
export type HeaderVariant = "default" | "game" | "transparent";

interface AppHeaderProps {
  activeRoute?: AppRoute;
  variant?: HeaderVariant;
}

const GAME_NAV_LINKS = [
  { id: "dice", labelKey: "nav.dice", href: "/casino/dice" },
  { id: "plinko", labelKey: "nav.plinko", href: "/casino/plinko" },
  { id: "slots", labelKey: "nav.slots", href: "/casino/slots" },
  { id: "baccarat", labelKey: "nav.baccarat", href: "/casino/baccarat" },
  { id: "sicbo", labelKey: "nav.sicBo", href: "/casino/sic-bo" },
  { id: "roulette", labelKey: "nav.roulette", href: "/casino/roulette" },
  { id: "cointoss", labelKey: "nav.coinToss", href: "/casino/coin-toss" },
  { id: "keno", labelKey: "nav.keno", href: "/casino/keno" }
] as const;

export function AppHeader({ activeRoute = "none", variant = "default" }: AppHeaderProps) {
  const isTransparent = variant === "transparent";
  const t = useTranslations();

  if (isTransparent) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border-soft bg-surface-0/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-6">
          <div className="flex items-center gap-12">
            <Link href="/" className="text-xl font-bold tracking-tight text-fg">
              ArbiGameFi
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-medium text-fg-muted md:flex">
              <Link href="/casino" className="transition-colors hover:text-fg">
                {t("nav.rooms")}
              </Link>
              <Link href="/earn" className="transition-colors hover:text-fg">
                {t("nav.liquidity")}
              </Link>
              <Link href="/affiliate" className="transition-colors hover:text-fg">
                {t("nav.affiliates")}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <LocaleSwitcher compact />
            <div className="hidden md:block">
              <WalletButton />
            </div>
            <Link
              href="/casino"
              className="hidden rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-fg-inverse transition-colors hover:bg-fg/90 sm:inline-flex"
            >
              {t("nav.openRooms")}
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const navLinks = [
    { id: "directory", label: t("nav.games"), href: "/casino" },
    { id: "sportsbook", label: t("nav.sportsbook"), href: "/sportsbook" },
    { id: "bets", label: t("nav.bets"), href: "/portfolio/activity" },
    { id: "liquidity", label: t("nav.liquidity"), href: "/earn" },
    { id: "claims", label: t("nav.claims"), href: "/portfolio/claims" },
    { id: "referral", label: t("nav.affiliates"), href: "/portfolio/referral" },
    { id: "account", label: t("nav.account"), href: "/portfolio" }
  ] as const;
  const mobileGameNav =
    variant === "game" ? (
      <div className="sticky top-20 z-40 border-b border-border bg-surface-0/95 px-4 py-2 backdrop-blur md:hidden">
        <nav
          aria-label={t("nav.casino")}
          className="flex gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link
            href="/casino"
            className="shrink-0 rounded-full border border-border-soft bg-surface-2 px-3 py-2 text-xs font-semibold text-fg-subtle"
          >
            ← {t("nav.casino")}
          </Link>
          {GAME_NAV_LINKS.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={cn(
                "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                activeRoute === link.id
                  ? "border-brand bg-brand text-fg-inverse"
                  : "border-border-soft bg-surface-2 text-fg-subtle hover:text-fg"
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
      </div>
    ) : null;

  return (
    <>
      <ShellHeader variant="solid">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-8">
          <ShellHeaderBrand name="ArbiGameFi" className="shrink-0" />

          {variant === "game" ? (
            <ShellHeaderNav className="flex-1 basis-0 gap-5 overscroll-x-contain pr-4">
              <Link
                href="/casino"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap [word-break:keep-all] text-fg-subtle transition-colors hover:text-fg"
              >
                <span>←</span>
                <span>{t("nav.casino")}</span>
              </Link>

              {GAME_NAV_LINKS.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className={cn(
                    "inline-flex shrink-0 items-center whitespace-nowrap [word-break:keep-all] transition-colors",
                    activeRoute === link.id
                      ? "border-b-2 border-brand pb-1 text-brand"
                      : "text-fg-subtle hover:text-fg"
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </ShellHeaderNav>
          ) : (
            <ShellHeaderNav className="flex-1">
              {navLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className={cn(
                    "inline-flex shrink-0 items-center whitespace-nowrap [word-break:keep-all] transition-colors",
                    activeRoute === link.id
                      ? "border-b-2 border-fg pb-1 text-fg"
                      : "text-fg-subtle hover:text-fg"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </ShellHeaderNav>
          )}
        </div>

        <ShellHeaderActions>
          <LocaleSwitcher compact />
          <NetworkSwitcher />
          <WalletButton />
        </ShellHeaderActions>
      </ShellHeader>
      {mobileGameNav}
    </>
  );
}
