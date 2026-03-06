"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReleaseBadge, ReadOnlyBanner, ThemeToggle } from "@ssot/ui";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { WalletButton } from "../app/providers/WalletButton";

function shortHex(addr?: string) {
  if (!addr) return "—";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

const NAV_LINKS = [
  { href: "/games", label: "Games" },
  { href: "/bets", label: "Bets" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/claims", label: "Claims" },
  { href: "/referral", label: "Referral" },
  { href: "/account", label: "Account" },
  { href: "/ops", label: "Ops" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { release, readOnly, readOnlyReason, warnings } = useRelease();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();

  // Close mobile menu on navigation
  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const networkName = release?.name ?? "Unknown";
  const hubShort = shortHex(release?.contracts.hub);
  const digestShort = (release?.releaseDigest ?? "—").slice(0, 8);

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col bg-slate-950 text-slate-200 antialiased font-sans">
      {/* Decorative Background Glows matching pure casino themes */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-slate-900/95 via-slate-900/75 to-slate-950/95" aria-hidden="true" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Glassmorphic Header - Replicated from reference UI visual-system */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
        <div className="pt-safe bg-slate-950/95" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 h-14 min-h-[3.5rem] px-6">
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center gap-2.5 mr-4 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform duration-200 hover:scale-105">
                  <span className="font-black text-black">N</span>
                </div>
                <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 group-hover:from-emerald-400 group-hover:to-green-400 transition-all duration-300">
                  NEXUS
                </span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden items-center gap-6 text-sm md:flex">
                {NAV_LINKS.map((l) => {
                  const isActive = pathname.startsWith(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`text-sm font-medium transition-colors ${isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              {/* Release Badge in Topbar */}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-300">
                <div className="w-1 h-1 bg-amber-400 rounded-full"></div>
                {networkName}
              </div>

              {/* Rainbow Wallet Button Substitute */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                <div className="relative">
                  <WalletButton />
                </div>
              </div>

              {/* Mobile hamburger - Reference Project Equivalent */}
              <div className="md:hidden relative">
                <button
                  type="button"
                  className="flex items-center justify-center w-11 h-11 rounded-lg border border-slate-700 bg-slate-800/50 active:bg-slate-700/50 active:scale-95 transition-all touch-manipulation"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-label="Toggle navigation menu"
                  style={{ touchAction: "manipulation" }}
                >
                  <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    {menuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile nav dropdown drawer pattern */}
          {menuOpen ? (
            <nav className="fixed bottom-0 left-0 right-0 z-[70] pb-safe" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0px)" }}>
              <div className="bg-slate-900 border-t border-slate-700 rounded-t-2xl shadow-2xl">
                <div className="px-4 pt-3 pb-2.5 border-b border-slate-700/50 bg-slate-800/50">
                  <div className="h-1 w-10 rounded-full bg-slate-600/50 mx-auto mb-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Navigation</span>
                    <button onClick={() => setMenuOpen(false)} className="text-slate-400 hover:text-slate-200 text-sm px-3 py-2 rounded-lg transition-colors">
                      Close
                    </button>
                  </div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto py-1 bg-slate-900/50 overscroll-contain">
                  {NAV_LINKS.map((l) => {
                    const isActive = pathname.startsWith(l.href);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`block px-4 py-3 text-sm transition-colors touch-manipulation flex items-center ${isActive
                          ? "text-white bg-slate-800/60"
                          : "text-slate-300 active:text-white active:bg-slate-800/40"
                          }`}
                        onClick={() => setMenuOpen(false)}
                        style={{ touchAction: "manipulation" }}
                      >
                        {l.label}
                      </Link>
                    );
                  })}
                </div>
                <div className="h-2" />
              </div>
            </nav>
          ) : null}
        </div>
      </header>

      {readOnly ? (
        <div className="mx-auto w-full max-w-7xl px-6 py-4 mt-16 z-10 relative">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl px-6 py-8 flex-1 z-10 relative mt-14 pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        {children}
      </main>
    </div>
  );
}
