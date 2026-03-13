"use client";

import Link from "next/link";
import * as React from "react";
import { ReadOnlyBanner } from "@ssot/ui";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { WalletButton } from "../app/providers/WalletButton";
import { ArbiGameFiBrand } from "./ArbiGameFiBrand";

const LANDING_LINKS = [
  { href: "/games", label: "Games" },
  { href: "/bets", label: "Bets" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/account", label: "Account" },
] as const;

export function LandingShell({ children }: { children: React.ReactNode }) {
  const { release, readOnly, readOnlyReason, warnings } = useRelease();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#050714] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#070b1a]/82 backdrop-blur-xl">
        <div
          className="pt-safe"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}
        >
          <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="shrink-0">
              <ArbiGameFiBrand accent="cyan" subtitle="Wallet-native casino rooms" />
            </Link>

            <nav className="hidden items-center gap-2 lg:flex">
              {LANDING_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="ag-pill-tab px-4 py-2 text-sm">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 lg:flex">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Live on
                </span>
                <span className="text-sm font-semibold text-white">{release?.name ?? "Unknown network"}</span>
              </div>

              <Link
                href="/games"
                className="hidden rounded-full border border-cyan-400/25 bg-cyan-400/12 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-400/18 lg:inline-flex"
              >
                Open Rooms
              </Link>

              <WalletButton />

              <button
                type="button"
                aria-label="Toggle navigation menu"
                aria-expanded={menuOpen}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 lg:hidden"
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
            </div>
          </div>

          {menuOpen ? (
            <div className="border-t border-white/5 bg-[#090e1f]/96 lg:hidden">
              <div className="mx-auto max-w-[1480px] grid gap-2 px-4 py-4 sm:px-6">
                {LANDING_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200"
                  >
                    {link.label}
                  </Link>
                ))}
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

      <main className={`mx-auto max-w-[1480px] px-4 pb-16 sm:px-6 lg:px-8 ${readOnly ? "pt-5" : "pt-[5.5rem]"}`}>
        {children}
      </main>
    </div>
  );
}
