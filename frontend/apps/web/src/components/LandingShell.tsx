"use client";

import * as React from "react";
import Link from "next/link";
import { ReadOnlyBanner } from "@ssot/ui";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { WalletButton } from "../app/providers/WalletButton";

function shortHex(addr?: string) {
  if (!addr) return "—";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

const LANDING_LINKS = [
  { href: "/games", label: "Rooms" },
  { href: "/bets", label: "Live Bets" },
  { href: "/liquidity", label: "Liquidity" }
] as const;

export function LandingShell({ children }: { children: React.ReactNode }) {
  const { release, readOnly, readOnlyReason, warnings } = useRelease();
  const networkName = release?.name ?? "Unknown";
  const hubShort = shortHex(release?.contracts.hub);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-200 antialiased">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.12),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,1))]"
        aria-hidden="true"
      />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div
          className="pt-safe bg-slate-950/70"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}
        >
          <div className="mx-auto flex h-16 max-w-[92rem] items-center justify-between gap-4 px-5 lg:px-8">
            <div className="flex items-center gap-8">
              <Link href="/" className="group flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 shadow-lg shadow-cyan-950/30 transition-transform duration-200 group-hover:scale-105">
                  <span className="text-sm font-black tracking-[0.24em] text-cyan-100">SS</span>
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-black uppercase tracking-[0.28em] text-white">
                    SSOT
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Live Rooms
                  </div>
                </div>
              </Link>

              <nav className="hidden items-center gap-6 lg:flex">
                {LANDING_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 lg:flex">
                <div className="text-sm font-semibold text-white">{networkName}</div>
                <div className="h-4 w-px bg-slate-800" />
                <div className="font-mono text-xs text-slate-400">{hubShort}</div>
              </div>
              <Link
                href="/games"
                className="hidden rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-cyan-400/15 lg:inline-flex"
              >
                Open Rooms
              </Link>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {readOnly ? (
        <div className="relative z-10 mx-auto mt-16 w-full max-w-[92rem] px-5 py-4 lg:px-8">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      <main className="relative z-10 mx-auto w-full max-w-[92rem] px-5 pb-14 pt-[calc(4rem+env(safe-area-inset-top,0px)+1.5rem)] lg:px-8 lg:pb-20 lg:pt-[calc(4rem+env(safe-area-inset-top,0px)+2rem)]">
        {children}
      </main>
    </div>
  );
}
