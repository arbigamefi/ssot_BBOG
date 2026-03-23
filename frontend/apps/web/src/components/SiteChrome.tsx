"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { LandingShell } from "./LandingShell";
import { RoomShell } from "./RoomShell";
import { TrustShell } from "./TrustShell";

/**
 * SiteChrome now acts only as a route-family dispatcher.
 * Visual truth lives in LandingShell / RoomShell / TrustShell.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/prototype")) {
    return <>{children}</>;
  }

  const isLanding = pathname === "/" || pathname === "/games";
  const isRoom = ["/roulette", "/dice", "/cointoss", "/keno"].includes(pathname);

  if (isLanding) {
    return <LandingShell>{children}</LandingShell>;
  }

  if (isRoom) {
    return <RoomShell>{children}</RoomShell>;
  }

  return <TrustShell>{children}</TrustShell>;
}
