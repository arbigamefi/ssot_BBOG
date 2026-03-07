"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReadOnlyBanner } from "@ssot/ui";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { WalletButton } from "../app/providers/WalletButton";

function shortHex(addr?: string) {
  if (!addr) return "—";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

const PRIMARY_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/bets", label: "Bets" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/account", label: "Account" }
] as const;

const ADVANCED_NAV_LINKS = [
  { href: "/claims", label: "Claims" },
  { href: "/referral", label: "Referral" },
  { href: "/ops", label: "Ops" }
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { release, readOnly, readOnlyReason, warnings } = useRelease();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const isGameRoom = /^\/games\/[^/]+$/.test(pathname);

  // Close mobile menu on navigation
  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const networkName = release?.name ?? "Unknown";
  const hubShort = shortHex(release?.contracts.hub);
  const digestShort = (release?.releaseDigest ?? "—").slice(0, 8);

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col bg-slate-950 text-slate-200 antialiased font-sans">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-slate-900/95 via-slate-900/75 to-slate-950/95"
        aria-hidden="true"
      />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
        <div
          className="pt-safe bg-slate-950/95"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}
        >
          <div
            className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 ${isGameRoom ? "h-14 min-h-[3.5rem]" : "h-16 min-h-[4rem]"}`}
          >
            <div className={`flex items-center ${isGameRoom ? "gap-3" : "gap-6"}`}>
              <Link href="/" className="group flex items-center gap-3">
                <div
                  className={`flex items-center justify-center border border-emerald-400/30 bg-emerald-400/10 shadow-lg shadow-emerald-950/40 transition-transform duration-200 group-hover:scale-105 ${isGameRoom ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-2xl"}`}
                >
                  <span className="text-sm font-black tracking-[0.18em] text-emerald-200">AG</span>
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-black tracking-[0.08em] text-white">
                    ArbiGameFi
                  </div>
                  {!isGameRoom ? (
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Game Rooms
                    </div>
                  ) : null}
                </div>
              </Link>

              {isGameRoom ? (
                <Link
                  href="/games"
                  className="hidden rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-700 hover:text-white md:inline-flex"
                >
                  All Games
                </Link>
              ) : (
                <div className="hidden items-center gap-3 md:flex">
                  <nav className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-1">
                    {PRIMARY_NAV_LINKS.map((l) => {
                      const isActive = isActivePath(pathname, l.href);
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            isActive
                              ? "bg-slate-200 text-slate-950 shadow-sm"
                              : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                          }`}
                        >
                          {l.label}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="hidden items-center gap-2 lg:flex">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Advanced
                    </span>
                    {ADVANCED_NAV_LINKS.map((l) => {
                      const isActive = isActivePath(pathname, l.href);
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                            isActive
                              ? "border-slate-200 bg-slate-200 text-slate-950"
                              : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-white"
                          }`}
                        >
                          {l.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div
                className={`hidden items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-2 ${isGameRoom ? "xl:flex" : "lg:flex"}`}
              >
                <div className="space-y-0.5 text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Release
                  </div>
                  <div className="text-sm font-semibold text-white">{networkName}</div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="space-y-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Digest
                  </div>
                  <div className="font-mono text-sm text-slate-300">{digestShort}</div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="space-y-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Hub
                  </div>
                  <div className="font-mono text-sm text-slate-300">{hubShort}</div>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                <div className="relative">
                  <WalletButton />
                </div>
              </div>

              <div className={`relative ${isGameRoom ? "hidden" : "md:hidden"}`}>
                <button
                  type="button"
                  className="flex items-center justify-center w-11 h-11 rounded-lg border border-slate-700 bg-slate-800/50 active:bg-slate-700/50 active:scale-95 transition-all touch-manipulation"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-label="Toggle navigation menu"
                  style={{ touchAction: "manipulation" }}
                >
                  <svg
                    className="h-6 w-6 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    {menuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {menuOpen ? (
            <nav
              className="fixed bottom-0 left-0 right-0 z-[70] pb-safe"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0px)" }}
            >
              <div className="bg-slate-900 border-t border-slate-700 rounded-t-2xl shadow-2xl">
                <div className="px-4 pt-3 pb-2.5 border-b border-slate-700/50 bg-slate-800/50">
                  <div className="h-1 w-10 rounded-full bg-slate-600/50 mx-auto mb-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Navigation
                    </span>
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="text-slate-400 hover:text-slate-200 text-sm px-3 py-2 rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto py-1 bg-slate-900/50 overscroll-contain">
                  <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Primary
                  </div>
                  {PRIMARY_NAV_LINKS.map((l) => {
                    const isActive = isActivePath(pathname, l.href);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`block px-4 py-3 text-sm transition-colors touch-manipulation flex items-center ${
                          isActive
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

                  <div className="mt-3 border-t border-slate-700/40 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Advanced
                  </div>
                  {ADVANCED_NAV_LINKS.map((l) => {
                    const isActive = isActivePath(pathname, l.href);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`block px-4 py-3 text-sm transition-colors touch-manipulation flex items-center ${
                          isActive
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
