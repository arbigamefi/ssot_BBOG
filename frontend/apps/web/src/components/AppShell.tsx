"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReadOnlyBanner } from "@ssot/ui";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { WalletButton } from "../app/providers/WalletButton";
import { ArbiGameFiBrand } from "./ArbiGameFiBrand";

const PRIMARY_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/bets", label: "Bets" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/account", label: "Account" },
] as const;

const SECONDARY_NAV_LINKS = [
  { href: "/claims", label: "Claims" },
  { href: "/referral", label: "Referral" },
  { href: "/ops", label: "Ops" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { release, readOnly, readOnlyReason, warnings } = useRelease();
  const isGameRoom = /^\/games\/[^/]+$/.test(pathname);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#050714] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#070b1a]/88 backdrop-blur-xl">
        <div
          className="pt-safe"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}
        >
          <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="shrink-0">
              <ArbiGameFiBrand accent="cyan" subtitle={isGameRoom ? undefined : "On-chain casino"} compact={isGameRoom} />
            </Link>

            {isGameRoom ? (
              <div className="hidden items-center gap-3 md:flex">
                <Link
                  href="/games"
                  className="ag-pill-tab px-4 py-2 text-sm"
                >
                  All Games
                </Link>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {release?.name ?? "Unknown network"}
                </div>
              </div>
            ) : (
              <nav className="hidden items-center gap-2 xl:flex">
                {PRIMARY_NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-active={isActivePath(pathname, link.href)}
                    className="ag-pill-tab px-4 py-2 text-sm"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            <div className="ml-auto flex items-center gap-3">
              {!isGameRoom ? (
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 lg:flex">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Live
                  </span>
                  <span className="text-sm font-semibold text-white">{release?.name ?? "Unknown network"}</span>
                </div>
              ) : null}

              <WalletButton />

              {!isGameRoom ? (
                <button
                  type="button"
                  aria-label="Toggle navigation menu"
                  aria-expanded={menuOpen}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 xl:hidden"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {menuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                    )}
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          {!isGameRoom ? (
            <div className="hidden border-t border-white/5 xl:block">
              <div className="mx-auto flex max-w-[1480px] items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Advanced
                </span>
                {SECONDARY_NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-active={isActivePath(pathname, link.href)}
                    className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-white/16 hover:text-white data-[active=true]:border-cyan-400/30 data-[active=true]:bg-cyan-400/10 data-[active=true]:text-cyan-100"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {menuOpen ? (
            <div className="border-t border-white/5 bg-[#090e1f]/96 xl:hidden">
              <div className="mx-auto max-w-[1480px] space-y-4 px-4 py-4 sm:px-6">
                <div className="grid gap-2">
                  {PRIMARY_NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {SECONDARY_NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {readOnly ? (
        <div className="mx-auto max-w-[1480px] px-4 pt-[5.5rem] sm:px-6 lg:px-8">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      <main
        className={`mx-auto max-w-[1480px] px-4 pb-12 sm:px-6 lg:px-8 ${
          readOnly ? "pt-5" : isGameRoom ? "pt-[5.5rem]" : "pt-[6.5rem]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
