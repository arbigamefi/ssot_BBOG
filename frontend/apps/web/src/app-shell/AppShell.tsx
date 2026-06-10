"use client";

import * as React from "react";
import { ReadOnlyBanner } from "@ssot/ui";
import { AppShell as AppShellFrame } from "@ssot/ui/patterns";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { AppHeader, type AppRoute } from "../components/AppHeader";
import { SiteFooter } from "../components/SiteFooter";
import { DISABLE_AGE_GATE_IN_DEV, DISABLE_ONBOARDING_IN_DEV } from "../config/dev-flags";
import { isCasinoModuleSlug } from "../features/casino/modules";
import {
  AgeTermsGate,
  CookieConsentBanner,
  RealityCheckTimer,
  ResponsibleGamblingDialog,
  SelfExclusionGate
} from "./compliance";
import { OnboardingTour } from "./onboarding/OnboardingTour";
import { InstallPrompt } from "./pwa/InstallPrompt";

function getActiveRoute(pathname: string): AppRoute {
  if (pathname === "/casino") return "directory";
  if (pathname === "/sportsbook" || pathname.startsWith("/sportsbook/")) return "sportsbook";
  if (pathname === "/portfolio/activity" || pathname.startsWith("/portfolio/activity/")) {
    return "bets";
  }
  if (pathname === "/earn") return "liquidity";
  if (pathname === "/portfolio/claims") return "claims";
  if (pathname === "/affiliate" || pathname === "/portfolio/referral") return "referral";
  if (pathname === "/portfolio") return "account";
  if (pathname === "/ops") return "ops";
  if (pathname === "/casino/roulette") return "roulette";
  if (pathname === "/casino/baccarat") return "baccarat";
  if (pathname === "/casino/sic-bo") return "sicbo";
  if (pathname === "/casino/dice") return "dice";
  if (pathname === "/casino/plinko") return "plinko";
  if (pathname === "/casino/slots") return "slots";
  if (pathname === "/casino/coin-toss") return "cointoss";
  if (pathname === "/casino/keno") return "keno";
  return "none";
}

function isCasinoGameRoom(pathname: string) {
  const match = /^\/casino\/([^/?#]+)$/.exec(pathname);
  return match ? isCasinoModuleSlug(match[1] ?? "") : false;
}

function getShellVariant(pathname: string) {
  if (pathname === "/" || pathname === "/affiliate") return "marketing";
  if (
    pathname === "/legal/terms" ||
    pathname === "/legal/privacy" ||
    pathname === "/legal/disclaimer"
  ) {
    return "legal";
  }
  if (isCasinoGameRoom(pathname)) return "game";
  return "product";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations();
  const { readOnly, readOnlyReason, warnings } = useRelease();
  const variant = getShellVariant(pathname);
  const headerVariant =
    variant === "marketing" ? "transparent" : variant === "game" ? "game" : "default";

  return (
    <>
      <AppShellFrame
        footer={<SiteFooter />}
        header={<AppHeader activeRoute={getActiveRoute(pathname)} variant={headerVariant} />}
        readOnlyBanner={
          readOnly ? (
            <ReadOnlyBanner reason={readOnlyReason ?? t("app.writesDisabled")} details={warnings} />
          ) : undefined
        }
        variant={variant}
      >
        <SelfExclusionGate>{children}</SelfExclusionGate>
      </AppShellFrame>

      {/* Compliance surfaces — render above the shell, ordered by priority:
          age/terms gate blocks everything; cookie banner + RG dialog sit on
          top; the reality-check timer is invisible bookkeeping. */}
      {DISABLE_AGE_GATE_IN_DEV ? null : <AgeTermsGate />}
      <CookieConsentBanner />
      <ResponsibleGamblingDialog />
      <RealityCheckTimer />
      {DISABLE_ONBOARDING_IN_DEV ? null : <OnboardingTour />}
      <InstallPrompt />
    </>
  );
}
