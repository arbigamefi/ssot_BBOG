"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ReadOnlyBanner, cn } from "@ssot/ui";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { PrototypeHeader, type PrototypeRoute } from "./PrototypeHeader";
import { SiteFooter } from "./SiteFooter";

function getActiveRoute(pathname: string): PrototypeRoute {
  if (pathname === "/games") return "directory";
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

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { readOnly, readOnlyReason, warnings } = useRelease();

  if (pathname.startsWith("/prototype")) {
    return <>{children}</>;
  }

  const isHome = pathname === "/";
  const isRoom = ["/roulette", "/dice", "/cointoss", "/keno"].some(
    (p) => pathname.startsWith(p) || pathname.startsWith(`/games${p}`)
  );

  const activeRoute = getActiveRoute(pathname);
  const headerVariant = isHome ? "transparent" : isRoom ? "game" : "default";

  return (
    <div
      className={cn(
        "min-h-screen text-white",
        isRoom ? "bg-[#030303] overflow-x-hidden" : "bg-[#050505]"
      )}
    >
      <PrototypeHeader activeRoute={activeRoute} variant={headerVariant} />

      {isRoom && (
        <>
          <div className="fixed left-1/2 top-1/2 z-0 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
          <div className="pointer-events-none fixed right-[-10%] top-[-20%] z-0 h-[800px] w-[800px] rounded-full bg-purple-900/20 blur-[200px]" />
          <div className="pointer-events-none fixed bottom-[-20%] left-[-10%] z-0 h-[600px] w-[600px] rounded-full bg-blue-900/10 blur-[150px]" />
        </>
      )}

      {readOnly && (
        <div
          className={cn(
            "mx-auto relative z-20 px-6",
            isRoom ? "max-w-[1600px] md:px-8" : "max-w-[1440px]",
            "pt-[5.5rem]"
          )}
        >
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      )}

      <main
        className={cn(
          "relative z-10 w-full pb-16 mx-auto",
          isRoom ? "flex max-w-[1600px] flex-col gap-6 px-4 md:px-8 pb-12" : "max-w-[1440px] px-6",
          readOnly ? "pt-5" : isHome ? "pt-0" : "pt-[5.5rem]"
        )}
      >
        {children}
      </main>

      {!isRoom && <SiteFooter />}
    </div>
  );
}
