"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReadOnlyBanner } from "@ssot/ui";
import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { WalletButton } from "../app/providers/WalletButton";

const MAIN_LINKS = [
  { href: "/games", label: "Games" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/referral", label: "Affiliates" },
  { href: "/account", label: "Account" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/games") return pathname.startsWith("/games") || pathname.startsWith("/bets");
  return pathname.startsWith(href);
}

export function GlobalSiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { release, readOnly, readOnlyReason, warnings } = useRelease();
  
  // Decide transparent vs solid. The homepage gets transparent so it blends with the dark Hero area.
  const isHomePage = pathname === "/";
  // The room view needs a solid variant, but technically all other pages look fine with solid.
  const variant = isHomePage ? "transparent" : "solid";

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 flex flex-col items-center">
      
      {/* 1. Global Product Header */}
      <ShellHeader variant={variant} className={isHomePage ? "absolute w-full" : "w-full"}>
        <div className="flex items-center gap-6 sm:gap-12">
          <Link href="/">
             <ShellHeaderBrand name="ArbiGameFi" />
          </Link>
          <ShellHeaderNav>
            {MAIN_LINKS.map(link => {
               const active = isActivePath(pathname, link.href);
               return (
                 <Link 
                   key={link.href} 
                   href={link.href} 
                   className={`transition-colors ${active ? "text-white border-b-2 border-white pb-1" : "hover:text-white"}`}
                 >
                   {link.label}
                 </Link>
               )
            })}
          </ShellHeaderNav>
        </div>
        
        <ShellHeaderActions>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/60 mr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            {release?.name ?? "Arbitrum"}
          </div>
          
          <WalletButton />
        </ShellHeaderActions>
      </ShellHeader>

      {/* 2. ReadOnly Banner if writes disabled */}
      {readOnly ? (
        <div className="w-full max-w-[1440px] px-6 mt-[4.5rem] relative z-20">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      {/* 3. Main Content Layer */}
      <div className={`w-full max-w-[1440px] flex-1 ${!isHomePage ? (readOnly ? "mt-4" : "mt-[4.5rem]") : ""}`}>
        {children}
      </div>

    </div>
  );
}
