"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ShellHeader, 
  ShellHeaderBrand, 
  ShellHeaderNav, 
  ShellHeaderActions, 
  cn 
} from "@ssot/ui";
import { WalletButton } from "../app/providers/WalletButton";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { UserCircleIcon } from "@heroicons/react/24/outline";

/**
 * SiteChrome: The high-fidelity V2 shell for the entire application.
 * This implementation is a "Clean Slate" replacement derived directly from
 * the institutional-grade prototypes.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { release } = useRelease();

  // 1. Prototype viewer bypass (leaves raw prototypes untouched)
  if (pathname.startsWith("/prototype")) {
    return <>{children}</>;
  }

  // 2. Routing Identity
  const isFlagship = pathname === "/";
  const isDice = pathname === "/dice" || pathname === "/games/dice";
  const isRoulette = pathname === "/roulette" || pathname === "/games/roulette";
  const isCoinToss = pathname === "/cointoss" || pathname === "/games/cointoss" || pathname === "/games/coin-toss";
  const isKeno = pathname === "/keno" || pathname === "/games/keno";
  const isGameRoom = isDice || isRoulette || isCoinToss || isKeno;

  // Header Variant Selection
  let headerVariant: "default" | "game" | "transparent" = "default";
  if (isFlagship) headerVariant = "transparent";
  else if (isGameRoom || pathname.startsWith("/games/")) headerVariant = "game";

  // Production Nav Links (1:1 with Prototype Mapping)
  const navLinks = [
    { id: "directory", label: "Games", href: "/games" },
    { id: "bets", label: "Bets", href: "/bets" },
    { id: "liquidity", label: "Liquidity", href: "/liquidity" },
    { id: "claims", label: "Claims", href: "/claims" },
    { id: "referral", label: "Affiliates", href: "/referral" },
    { id: "account", label: "Account", href: "/account" },
    { id: "ops", label: "Ops", href: "/ops" },
  ] as const;

  // Active State Detection
  let activeRouteId = "none";
  if (pathname.startsWith("/games")) activeRouteId = "directory";
  else if (pathname.startsWith("/bets")) activeRouteId = "bets";
  else if (pathname.startsWith("/liquidity")) activeRouteId = "liquidity";
  else if (pathname.startsWith("/claims")) activeRouteId = "claims";
  else if (pathname.startsWith("/referral")) activeRouteId = "referral";
  else if (pathname.startsWith("/account")) activeRouteId = "account";
  else if (pathname.startsWith("/ops")) activeRouteId = "ops";

  // Game Route Identity
  let activeGameId = "none";
  if (isDice) activeGameId = "dice";
  if (isRoulette) activeGameId = "roulette";
  if (isCoinToss) activeGameId = "cointoss";
  if (isKeno) activeGameId = "keno";

  // --- SPECIAL: Flagship (Transparent) Shell ---
  if (headerVariant === "transparent") {
    return (
      <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#050505]/80 backdrop-blur-md">
          <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-6">
            <div className="flex items-center gap-12">
              <Link href="/" className="text-xl font-bold tracking-tight text-white hover:opacity-80 transition-opacity flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-emerald-500" />
                ArbiGameFi
              </Link>
              <nav className="hidden items-center gap-8 text-sm font-medium text-white/60 md:flex">
                <Link href="/games" className="transition-colors hover:text-white">Rooms</Link>
                <Link href="/liquidity" className="transition-colors hover:text-white">Liquidity</Link>
                <Link href="/bets" className="transition-colors hover:text-white">Ledger</Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <WalletButton />
              </div>
              <Link href="/games" className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-black transition-all hover:bg-white/90 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                Open Rooms
              </Link>
            </div>
          </div>
        </header>
        {children}
      </div>
    );
  }

  // --- STANDARD: V2 Solid Shell ---
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      <ShellHeader variant="solid">
        <div className="flex items-center gap-6 md:gap-12 w-full">
          <Link href="/" className="flex-shrink-0 group">
             <ShellHeaderBrand name="ArbiGameFi" className="group-hover:opacity-80 transition-opacity" />
          </Link>
          
          {headerVariant === "game" ? (
            <ShellHeaderNav>
              <Link href="/dice" className={cn("transition-colors", activeGameId === "dice" ? "text-purple-400 border-b-2 border-purple-400 pb-1" : "text-white/40 hover:text-white")}>Dice</Link>
              <Link href="/roulette" className={cn("transition-colors", activeGameId === "roulette" ? "text-emerald-400 border-b-2 border-emerald-400 pb-1" : "text-white/40 hover:text-white")}>Roulette</Link>
              <Link href="/cointoss" className={cn("transition-colors", activeGameId === "cointoss" ? "text-amber-400 border-b-2 border-amber-400 pb-1" : "text-white/40 hover:text-white")}>Coin Toss</Link>
              <Link href="/keno" className={cn("transition-colors", activeGameId === "keno" ? "text-fuchsia-400 border-b-2 border-fuchsia-400 pb-1" : "text-white/40 hover:text-white")}>Keno</Link>
              
              <div className="hidden sm:block border-l border-white/10 h-6 pl-6 ml-2">
                <Link href="/games" className="text-white/40 hover:text-white transition-colors text-sm font-bold flex items-center gap-2 h-full uppercase tracking-widest group">
                  <span className="group-hover:-translate-x-1 transition-transform">←</span>
                  <span>Hub</span>
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
                    "transition-colors whitespace-nowrap text-sm font-medium",
                    activeRouteId === link.id
                      ? "text-white border-b-2 border-white pb-1"
                      : "text-white/40 hover:text-white"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </ShellHeaderNav>
          )}
        </div>

        <ShellHeaderActions>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/40 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></span>
            Arbitrum Node
          </div>
          <button className="hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
            <UserCircleIcon className="w-5 h-5 text-white/70" />
          </button>
          <WalletButton />
        </ShellHeaderActions>
      </ShellHeader>

      <main className={cn(
        "relative",
        headerVariant === "game" ? "pt-0" : "max-w-[1440px] mx-auto px-6 pt-12"
      )}>
        {children}
      </main>

      {/* Global Bottom Gradient Ambience */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-900/5 to-transparent pointer-events-none z-0" />
    </div>
  );
}

