"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ReadOnlyBanner } from "@ssot/ui";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { PrototypeHeader, type PrototypeRoute } from "./PrototypeHeader";

function getActiveRoute(pathname: string): PrototypeRoute {
  if (pathname === "/roulette" || pathname === "/games/roulette") return "roulette";
  if (pathname === "/dice" || pathname === "/games/dice") return "dice";
  if (pathname === "/cointoss" || pathname === "/games/coin-toss" || pathname === "/games/cointoss")
    return "cointoss";
  if (pathname === "/keno" || pathname === "/games/keno") return "keno";
  return "none";
}

export function RoomShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { readOnly, readOnlyReason, warnings } = useRelease();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030303] text-white">
      <PrototypeHeader activeRoute={getActiveRoute(pathname)} variant="game" />

      <div className="fixed left-1/2 top-1/2 z-0 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="pointer-events-none fixed right-[-10%] top-[-20%] z-0 h-[800px] w-[800px] rounded-full bg-purple-900/20 blur-[200px]" />
      <div className="pointer-events-none fixed bottom-[-20%] left-[-10%] z-0 h-[600px] w-[600px] rounded-full bg-blue-900/10 blur-[150px]" />

      {readOnly ? (
        <div className="mx-auto max-w-[1600px] px-4 pt-[5.5rem] md:px-8">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      <main
        className={`relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 pb-12 md:px-8 ${readOnly ? "pt-5" : "pt-[5.5rem]"}`}
      >
        {children}
      </main>
    </div>
  );
}
