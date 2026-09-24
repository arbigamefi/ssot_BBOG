import * as React from "react";

import { cn } from "../lib/utils";

export type AppShellVariant = "marketing" | "product" | "game" | "legal";

export type AppShellProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  readOnlyBanner?: React.ReactNode;
  variant?: AppShellVariant;
  fullBleed?: boolean;
  skipLinkLabel?: string;
};

export function AppShell({
  children,
  footer,
  header,
  readOnlyBanner,
  fullBleed = false,
  skipLinkLabel = "Skip to content",
  variant = "product"
}: AppShellProps) {
  const isGame = variant === "game";
  const isMarketing = variant === "marketing";

  return (
    <div
      className={cn(
        "min-h-screen bg-surface-0 text-fg theme-dark",
        isGame ? "overflow-x-clip selection:bg-brand/30" : "selection:bg-brand/20"
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-md focus:bg-fg focus:px-5 focus:py-3 focus:font-semibold focus:text-fg-inverse"
      >
        {skipLinkLabel}
      </a>
      {header}

      {isGame ? (
        <>
          <div className="pointer-events-none fixed left-1/2 top-1/2 z-0 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
          <div className="pointer-events-none fixed right-[-10%] top-[-20%] z-0 h-[800px] w-[800px] rounded-full bg-brand/12 blur-[200px]" />
          <div className="pointer-events-none fixed bottom-[-20%] left-[-10%] z-0 h-[600px] w-[600px] rounded-full bg-accent/8 blur-[150px]" />
        </>
      ) : null}

      {readOnlyBanner ? (
        <div
          className={cn(
            "relative z-20 mx-auto px-4 sm:px-6",
            isMarketing ? "pt-24" : "pt-5",
            isGame ? "max-w-[1600px] md:px-8" : "max-w-[1440px]"
          )}
        >
          {readOnlyBanner}
        </div>
      ) : null}

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "relative z-10 mx-auto w-full scroll-mt-28 pb-16 focus:outline-none",
          fullBleed
            ? "max-w-none px-0 pb-0"
            : isGame
              ? "flex max-w-[1600px] flex-col gap-6 px-4 pb-12 md:px-8"
              : "max-w-[1440px] px-4 sm:px-6",
          readOnlyBanner ? "pt-5" : isMarketing ? "pt-0" : isGame ? "pt-5" : "pt-10"
        )}
      >
        {children}
      </main>

      {!isGame ? footer : null}
    </div>
  );
}
