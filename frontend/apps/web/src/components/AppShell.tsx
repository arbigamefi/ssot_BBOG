"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ReadOnlyBanner, cn } from "@ssot/ui";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { AppHeader, type AppRoute } from "./AppHeader";
import { SiteFooter } from "./SiteFooter";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { readOnly, readOnlyReason, warnings } = useRelease();

  const isHome = pathname === "/";
  const isEarn = pathname === "/invest" || pathname.startsWith("/liquidity");
  const isClaims = pathname === "/claims";
  const isReferral = pathname === "/referral";
  const isAccount = pathname === "/account";
  const isBets = pathname === "/bets" || pathname.startsWith("/bets/");
  const isOps = pathname === "/ops";
  const isLegal = pathname === "/terms" || pathname === "/privacy" || pathname === "/disclaimer";
  const isRoom =
    pathname.startsWith("/games/") ||
    ["/roulette", "/dice", "/cointoss", "/keno"].some((p) => pathname.startsWith(p));

  const activeRoute = getActiveRoute(pathname);
  const headerVariant = isHome ? "transparent" : isRoom ? "game" : "default";

  return (
    <div
      className={cn(
        "min-h-screen bg-surface-0 text-fg",
        (isHome ||
          isEarn ||
          isClaims ||
          isReferral ||
          isAccount ||
          isBets ||
          isOps ||
          isLegal ||
          isRoom) &&
          "theme-dark",
        isRoom ? "overflow-x-hidden selection:bg-brand/30" : "selection:bg-brand/20"
      )}
    >
      <AppHeader activeRoute={activeRoute} variant={headerVariant} />

      {isRoom ? (
        <>
          <div className="pointer-events-none fixed left-1/2 top-1/2 z-0 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
          <div className="pointer-events-none fixed right-[-10%] top-[-20%] z-0 h-[800px] w-[800px] rounded-full bg-brand/12 blur-[200px]" />
          <div className="pointer-events-none fixed bottom-[-20%] left-[-10%] z-0 h-[600px] w-[600px] rounded-full bg-accent/8 blur-[150px]" />
        </>
      ) : null}

      {readOnly ? (
        <div
          className={cn(
            "relative z-20 mx-auto px-6",
            isRoom ? "max-w-[1600px] md:px-8" : "max-w-[1440px]",
            "pt-[5.5rem]"
          )}
        >
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      <main
        className={cn(
          "relative z-10 mx-auto w-full pb-16",
          isRoom ? "flex max-w-[1600px] flex-col gap-6 px-4 pb-12 md:px-8" : "max-w-[1440px] px-6",
          readOnly ? "pt-5" : isHome ? "pt-0" : "pt-[5.5rem]"
        )}
      >
        {children}
      </main>

      {!isRoom ? <SiteFooter /> : null}
    </div>
  );
}
