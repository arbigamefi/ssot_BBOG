import React from "react";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { cn } from "@ssot/ui";

export type PrototypeRoute =
  | "directory"
  | "bets"
  | "liquidity"
  | "claims"
  | "referral"
  | "account"
  | "ops"
  | "none"
  | "dice"
  | "roulette"
  | "cointoss"
  | "keno";
export type HeaderVariant = "default" | "game" | "transparent";

interface PrototypeHeaderProps {
  activeRoute?: PrototypeRoute;
  variant?: HeaderVariant;
}

export function PrototypeHeader({
  activeRoute = "none",
  variant = "default"
}: PrototypeHeaderProps) {
  const isTransparent = variant === "transparent";

  // Flagship uses a completely custom transparent layout for the marketing vibe.
  if (isTransparent) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#050505]/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-6">
          <div className="flex items-center gap-12">
            <div className="text-xl font-bold tracking-tight text-white">ArbiGameFi</div>
            <nav className="hidden items-center gap-6 text-sm font-medium text-white/60 md:flex">
              <Link
                href="/prototype/ui-ux-v2-directory"
                className="transition-colors hover:text-white"
              >
                Rooms
              </Link>
              <Link
                href="/prototype/ui-ux-v2-liquidity"
                className="transition-colors hover:text-white"
              >
                Liquidity
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="hidden px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white md:flex">
              Connect Wallet
            </button>
            <Link
              href="/prototype/ui-ux-v2-directory"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90"
            >
              Open Rooms
            </Link>
          </div>
        </div>
      </header>
    );
  }

  // Common Nav Links
  const navLinks = [
    { id: "directory", label: "Games", href: "/prototype/ui-ux-v2-directory" },
    { id: "bets", label: "Bets", href: "/prototype/ui-ux-v2-bets" },
    { id: "liquidity", label: "Liquidity", href: "/prototype/ui-ux-v2-liquidity" },
    { id: "claims", label: "Claims", href: "/prototype/ui-ux-v2-claims" },
    { id: "referral", label: "Affiliates", href: "/prototype/ui-ux-v2-referral" },
    { id: "account", label: "Account", href: "/prototype/ui-ux-v2-account" },
    { id: "ops", label: "Ops", href: "/prototype/ui-ux-v2-ops" }
  ] as const;

  return (
    <ShellHeader variant="solid">
      <div className="flex items-center gap-6 md:gap-12 w-full">
        <ShellHeaderBrand name="ArbiGameFi" />

        {variant === "game" ? (
          <ShellHeaderNav>
            <Link
              href="/prototype/ui-ux-v2-dice"
              className={cn(
                "transition-colors",
                activeRoute === "dice"
                  ? "text-purple-400 border-b-2 border-purple-400 pb-1"
                  : "text-white/40 hover:text-white"
              )}
            >
              Dice
            </Link>
            <Link
              href="/prototype/ui-ux-v2-roulette"
              className={cn(
                "transition-colors",
                activeRoute === "roulette"
                  ? "text-emerald-400 border-b-2 border-emerald-400 pb-1"
                  : "text-white/40 hover:text-white"
              )}
            >
              Roulette
            </Link>
            <Link
              href="/prototype/ui-ux-v2-cointoss"
              className={cn(
                "transition-colors",
                activeRoute === "cointoss"
                  ? "text-amber-400 border-b-2 border-amber-400 pb-1"
                  : "text-white/40 hover:text-white"
              )}
            >
              Coin Toss
            </Link>
            <Link
              href="/prototype/ui-ux-v2-keno"
              className={cn(
                "transition-colors",
                activeRoute === "keno"
                  ? "text-fuchsia-400 border-b-2 border-fuchsia-400 pb-1"
                  : "text-white/40 hover:text-white"
              )}
            >
              Keno
            </Link>

            <div className="hidden sm:block border-l border-white/10 h-6 pl-6 ml-2">
              <Link
                href="/prototype/ui-ux-v2-directory"
                className="text-white/40 hover:text-white transition-colors text-sm font-bold flex items-center gap-2 h-full uppercase tracking-wider"
              >
                <span>←</span>
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
                  "transition-colors",
                  activeRoute === link.id
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
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/60">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          Arbitrum
        </div>
        <button className="hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
          <UserCircleIcon className="w-5 h-5 text-white/70" />
        </button>
        <button className="flex items-center gap-2 bg-white/10 border border-white/10 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-white/20 transition-transform active:scale-95">
          <WalletIcon className="w-4 h-4" />
          <span>0x12...34af</span>
        </button>
      </ShellHeaderActions>
    </ShellHeader>
  );
}
