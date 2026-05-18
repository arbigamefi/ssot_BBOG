import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { cn } from "@ssot/ui";
import { WalletButton } from "../app-shell/WalletButton";
import { useRelease } from "../ssot/release/ReleaseProvider";
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
  | "roulette"
  | "cointoss"
  | "keno";
export type HeaderVariant = "default" | "game" | "transparent";

interface AppHeaderProps {
  activeRoute?: AppRoute;
  variant?: HeaderVariant;
}

export function AppHeader({ activeRoute = "none", variant = "default" }: AppHeaderProps) {
  const isTransparent = variant === "transparent";
  const { release } = useRelease();
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
              className="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-fg-inverse transition-colors hover:bg-fg/90"
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
    { id: "account", label: t("nav.account"), href: "/portfolio" },
    { id: "ops", label: t("nav.ops"), href: "/ops" }
  ] as const;

  return (
    <ShellHeader variant="solid">
      <div className="flex items-center gap-6 md:gap-12 w-full">
        <ShellHeaderBrand name="ArbiGameFi" />

        {variant === "game" ? (
          <ShellHeaderNav>
            <Link
              href="/casino/dice"
              className={cn(
                "transition-colors",
                activeRoute === "dice"
                  ? "border-b-2 border-brand pb-1 text-brand"
                  : "text-fg-subtle hover:text-fg"
              )}
            >
              {t("nav.dice")}
            </Link>
            <Link
              href="/casino/roulette"
              className={cn(
                "transition-colors",
                activeRoute === "roulette"
                  ? "border-b-2 border-brand pb-1 text-brand"
                  : "text-fg-subtle hover:text-fg"
              )}
            >
              {t("nav.roulette")}
            </Link>
            <Link
              href="/casino/coin-toss"
              className={cn(
                "transition-colors",
                activeRoute === "cointoss"
                  ? "border-b-2 border-brand pb-1 text-brand"
                  : "text-fg-subtle hover:text-fg"
              )}
            >
              {t("nav.coinToss")}
            </Link>
            <Link
              href="/casino/keno"
              className={cn(
                "transition-colors",
                activeRoute === "keno"
                  ? "border-b-2 border-brand pb-1 text-brand"
                  : "text-fg-subtle hover:text-fg"
              )}
            >
              {t("nav.keno")}
            </Link>

            <div className="hidden h-6 border-l border-border-soft pl-6 ml-2 sm:block">
              <Link
                href="/casino"
                className="flex h-full items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-subtle transition-colors hover:text-fg"
              >
                <span>←</span>
                <span>{t("nav.casino")}</span>
              </Link>
            </div>
          </ShellHeaderNav>
        ) : (
          <ShellHeaderNav>
            {navLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className={cn(
                  "transition-colors",
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
        <div className="hidden items-center gap-2 rounded-full border border-border-soft bg-surface-2 px-3 py-1.5 font-mono text-xs text-fg-muted sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-brand"></span>
          {release?.name ?? t("app.unknownNetwork")}
        </div>
        <WalletButton />
      </ShellHeaderActions>
    </ShellHeader>
  );
}
