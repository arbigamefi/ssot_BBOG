"use client";

import * as React from "react";
import { ReadOnlyBanner } from "@ssot/ui";
import { AppShell as AppShellFrame } from "@ssot/ui/patterns";
import { usePathname } from "next/navigation";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { AppHeader, type AppRoute } from "../components/AppHeader";
import { SiteFooter } from "../components/SiteFooter";

function getActiveRoute(pathname: string): AppRoute {
  if (pathname === "/games") return "directory";
  if (pathname === "/sportsbook" || pathname.startsWith("/sportsbook/")) return "sportsbook";
  if (pathname === "/bets" || pathname.startsWith("/bets/")) return "bets";
  if (pathname === "/invest" || pathname.startsWith("/liquidity")) return "liquidity";
  if (pathname === "/claims") return "claims";
  if (pathname === "/referral") return "referral";
  if (pathname === "/account") return "account";
  if (pathname === "/ops") return "ops";
  if (pathname === "/roulette" || pathname === "/games/roulette") return "roulette";
  if (pathname === "/dice" || pathname === "/games/dice") return "dice";
  if (pathname === "/cointoss" || pathname === "/games/coin-toss" || pathname === "/games/cointoss")
    return "cointoss";
  if (pathname === "/keno" || pathname === "/games/keno") return "keno";
  return "none";
}

function getShellVariant(pathname: string) {
  if (pathname === "/") return "marketing";
  if (pathname === "/terms" || pathname === "/privacy" || pathname === "/disclaimer") {
    return "legal";
  }
  if (
    pathname.startsWith("/games/") ||
    ["/roulette", "/dice", "/cointoss", "/keno"].some((path) => pathname.startsWith(path))
  ) {
    return "game";
  }
  return "product";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { readOnly, readOnlyReason, warnings } = useRelease();
  const variant = getShellVariant(pathname);
  const headerVariant =
    variant === "marketing" ? "transparent" : variant === "game" ? "game" : "default";

  return (
    <AppShellFrame
      footer={<SiteFooter />}
      header={<AppHeader activeRoute={getActiveRoute(pathname)} variant={headerVariant} />}
      readOnlyBanner={
        readOnly ? (
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        ) : undefined
      }
      variant={variant}
    >
      {children}
    </AppShellFrame>
  );
}
