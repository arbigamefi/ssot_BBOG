"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { 
  ShellHeader, 
  ShellHeaderBrand, 
  ShellHeaderNav, 
  ShellHeaderActions,
  ReadOnlyBanner
} from "@ssot/ui";
import Link from "next/link";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { WalletButton } from "../app/providers/WalletButton";

// Navigation Maps per Shell
const TRUST_NAV = [
  { href: "/games", label: "Games" },
  { href: "/bets", label: "Bets" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/referral", label: "Affiliates" },
  { href: "/account", label: "Account" },
] as const;

const DIRECTORY_NAV = [
  { href: "/games", label: "Games" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/referral", label: "Affiliates" },
] as const;

const LANDING_NAV = [
  { href: "/games", label: "Open Rooms" },
  { href: "/liquidity", label: "Liquidity" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/games") return pathname.startsWith("/games") && !pathname.includes("/", 7); // Simple check for directory vs room
  return pathname.startsWith(href);
}

/**
 * ShellSwitcher: The architectural brain that decides which "Atmosphere" and "Chrome" 
 * to apply based on the UI-UX Architecture Pack.
 */
export function ShellSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { release, readOnly, readOnlyReason, warnings } = useRelease();

  // 1. Identify Shell Type
  const isLanding = pathname === "/";
  const isDirectory = pathname === "/games";
  const isRoom = pathname.startsWith("/games/") && pathname.split("/").length > 2;
  const isTrust = ["/bets", "/account", "/referral", "/liquidity", "/claims", "/ops"].some(p => pathname.startsWith(p));

  // 2. Common Atmospheric Layer (Always present but intensity may vary)
  const atmosphericLayer = (
    <>
      <div className="fixed left-[-10%] top-[-20%] h-[50vw] w-[50vw] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none z-0" />
      <div className="fixed right-[-10%] top-[20%] h-[40vw] w-[40vw] rounded-full bg-fuchsia-600/10 blur-[120px] pointer-events-none z-0" />
    </>
  );

  // 3. Render Logic
  
  // -- A. ROOM SHELL (Gameplay Mode) --
  if (isRoom) {
     return (
       <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30 flex flex-col items-center relative overflow-x-hidden">
         {atmosphericLayer}
         <ShellHeader variant="solid" className="w-full border-b border-white/5 opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-4">
               <Link href="/games" className="text-white/40 hover:text-white transition-colors">← All Rooms</Link>
               <span className="text-white/20">|</span>
               <ShellHeaderBrand name="ArbiGameFi" />
            </div>
            <ShellHeaderActions>
               <WalletButton />
            </ShellHeaderActions>
         </ShellHeader>
         <div className="w-full flex-1 relative z-10">
           {children}
         </div>
       </div>
     );
  }

  // -- B. LANDING SHELL (Acquisition Mode) --
  if (isLanding) {
    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 flex flex-col items-center relative overflow-x-hidden">
        {atmosphericLayer}
        <ShellHeader variant="transparent" className="absolute w-full z-50">
          <Link href="/">
             <ShellHeaderBrand name="ArbiGameFi" />
          </Link>
          <ShellHeaderNav>
            {LANDING_NAV.map(link => (
              <Link key={link.href} href={link.href} className="text-white/60 hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </ShellHeaderNav>
          <ShellHeaderActions>
            <WalletButton />
          </ShellHeaderActions>
        </ShellHeader>
        <div className="w-full flex-1 relative z-10">
          {children}
        </div>
      </div>
    );
  }

  // -- C. DIRECTORY & TRUST SHELLS (Shared Base with Nav variance) --
  const navLinks = isDirectory ? DIRECTORY_NAV : TRUST_NAV;
  
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30 flex flex-col items-center relative overflow-x-hidden">
      {atmosphericLayer}
      
      <header className="w-full sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-md border-b border-white/5 h-20 flex flex-col justify-center">
        <div className="max-w-[1440px] w-full mx-auto px-6 flex items-center justify-between">
           <div className="flex items-center gap-10 sm:gap-14">
             <Link href="/">
                <ShellHeaderBrand name="ArbiGameFi" />
             </Link>
             <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
               {navLinks.map(link => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link 
                      key={link.href} 
                      href={link.href} 
                      className={`transition-all duration-300 ${active ? "text-white border-b-2 border-white pb-1" : "text-white/40 hover:text-white"}`}
                    >
                      {link.label}
                    </Link>
                  )
               })}
             </nav>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                {release?.name ?? "Mainnet"}
              </div>
              <WalletButton />
           </div>
        </div>
      </header>

      {readOnly && (
        <div className="w-full max-w-[1440px] px-6 mt-4 relative z-50">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      )}

      <main className="w-full max-w-[1440px] flex-1 relative z-10">
        {children}
      </main>
    </div>
  );
}
