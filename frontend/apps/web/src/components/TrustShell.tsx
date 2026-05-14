"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ReadOnlyBanner,
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderBrand,
  ShellHeaderNav
} from "@ssot/ui";

import { WalletButton } from "../app/providers/WalletButton";
import { useRelease } from "../ssot/release/ReleaseProvider";

const TRUST_NAV = [
  { href: "/games", label: "Games" },
  { href: "/sportsbook", label: "Sportsbook" },
  { href: "/invest", label: "Liquidity" },
  { href: "/bets", label: "Bets" },
  { href: "/claims", label: "Claims" },
  { href: "/referral", label: "Affiliates" },
  { href: "/account", label: "Account" }
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/games") {
    return ["/games", "/dice", "/cointoss", "/roulette", "/keno"].some((candidate) =>
      pathname.startsWith(candidate)
    );
  }
  if (href === "/invest")
    return pathname.startsWith("/invest") || pathname.startsWith("/liquidity");
  return pathname.startsWith(href);
}

export function TrustShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { release, readOnly, readOnlyReason, warnings } = useRelease();

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <ShellHeader>
        <Link href="/">
          <ShellHeaderBrand name="ArbiGameFi" />
        </Link>
        <ShellHeaderNav>
          {TRUST_NAV.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "text-white border-b-2 border-white" : "text-white/50"}
              >
                {link.label}
              </Link>
            );
          })}
        </ShellHeaderNav>
        <ShellHeaderActions>
          <span>{release?.name ?? "Unknown network"}</span>
          <WalletButton />
        </ShellHeaderActions>
      </ShellHeader>

      {readOnly ? (
        <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
      ) : null}

      <main>{children}</main>
    </div>
  );
}
