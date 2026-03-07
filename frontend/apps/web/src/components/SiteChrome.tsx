"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";
import { LandingShell } from "./LandingShell";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return <LandingShell>{children}</LandingShell>;
  }

  return <AppShell>{children}</AppShell>;
}
