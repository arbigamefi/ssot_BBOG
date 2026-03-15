"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { GlobalSiteShell } from "./GlobalSiteShell";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // If we are looking at the raw prototype viewer, don't shell it
  if (pathname.startsWith("/prototype")) {
    return <>{children}</>;
  }

  // Use the brand new, clean, single source of truth shell
  return <GlobalSiteShell>{children}</GlobalSiteShell>;
}
