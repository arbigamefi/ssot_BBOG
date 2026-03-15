"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ShellSwitcher } from "./ShellSwitcher";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // If we are looking at the raw prototype viewer, don't shell it
  if (pathname.startsWith("/prototype")) {
    return <>{children}</>;
  }

  // Use the architectural multi-shell switcher
  return <ShellSwitcher>{children}</ShellSwitcher>;
}
