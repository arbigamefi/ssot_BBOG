"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ReadOnlyBanner, cn } from "@ssot/ui";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { PrototypeHeader, type PrototypeRoute } from "./PrototypeHeader";
import { SiteFooter } from "./SiteFooter";

function getActiveRoute(pathname: string): PrototypeRoute {
  if (pathname === "/bets" || pathname.startsWith("/bets/")) return "bets";
  if (pathname === "/invest" || pathname.startsWith("/liquidity")) return "liquidity";
  if (pathname === "/claims") return "claims";
  if (pathname === "/referral") return "referral";
  if (pathname === "/account") return "account";
  if (pathname === "/ops") return "ops";
  return "none";
}

export function TrustShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { readOnly, readOnlyReason, warnings } = useRelease();
  const activeRoute = getActiveRoute(pathname);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PrototypeHeader activeRoute={activeRoute} />

      {readOnly ? (
        <div className="mx-auto max-w-[1440px] px-6 pt-[5.5rem]">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      <main
        className={cn(
          "mx-auto w-full max-w-[1440px] px-6 pb-16",
          readOnly ? "pt-5" : "pt-[5.5rem]"
        )}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
