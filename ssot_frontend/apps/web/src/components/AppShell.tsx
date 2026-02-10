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
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold">SSOT v2</Link>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-4 text-sm md:flex">
              {NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="hover:underline">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ReleaseBadge networkName={networkName} hubShort={hubShort} digestShort={digestShort} />
            </div>
            <ThemeToggle />
            <WalletButton />
            {/* Mobile hamburger */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-sm md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {menuOpen ? (
          <nav className="border-t px-4 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-2 text-sm">
              {NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="py-1 hover:underline">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-3">
              <ReleaseBadge networkName={networkName} hubShort={hubShort} digestShort={digestShort} />
            </div>
          </nav>
        ) : null}
      </header>

      {readOnly ? (
        <div className="mx-auto max-w-6xl p-4">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
