"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ReadOnlyBanner } from "@ssot/ui";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { SiteFooter } from "./SiteFooter";
import { PrototypeHeader } from "./PrototypeHeader";

export function LandingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { release, readOnly, readOnlyReason, warnings } = useRelease();
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PrototypeHeader
        activeRoute={pathname === "/games" ? "directory" : "none"}
        variant={isHome ? "transparent" : "default"}
      />

      {readOnly ? (
        <div className="mx-auto max-w-[1440px] px-6 pt-[5.5rem]">
          <ReadOnlyBanner reason={readOnlyReason ?? "Writes are disabled."} details={warnings} />
        </div>
      ) : null}

      <main
        className={`w-full flex-1 pb-16 ${readOnly ? "pt-5" : isHome ? "pt-0" : "pt-[5.5rem]"}`}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
