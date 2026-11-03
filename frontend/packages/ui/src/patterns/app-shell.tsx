import * as React from "react";

import { cn } from "../lib/utils";

export type AppShellVariant = "product" | "game";

export type AppShellProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  readOnlyBanner?: React.ReactNode;
  variant?: AppShellVariant;
  /** A page rebuilt in Carbon copy: it runs edge to edge on carbon and paper. */
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
  // Game rooms not yet rebuilt keep their glow and their sticky bet bar in place of the footer.
  const oldGameRoom = variant === "game" && !fullBleed;

  return (
    <div
      className={cn(
        "min-h-screen",
        fullBleed
          ? "bg-carbon text-paper"
          : cn(
              "bg-surface-0 text-fg theme-dark",
              oldGameRoom ? "overflow-x-clip selection:bg-brand/30" : "selection:bg-brand/20"
            )
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-print focus:bg-paper focus:px-5 focus:py-3 focus:font-semibold focus:text-ink focus:outline-2 focus:outline-offset-2 focus:outline-ink"
      >
        {skipLinkLabel}
      </a>
      {header}
      {readOnlyBanner}

      {oldGameRoom ? (
        <>
          <div className="pointer-events-none fixed left-1/2 top-1/2 z-0 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
          <div className="pointer-events-none fixed right-[-10%] top-[-20%] z-0 h-[800px] w-[800px] rounded-full bg-brand/12 blur-[200px]" />
          <div className="pointer-events-none fixed bottom-[-20%] left-[-10%] z-0 h-[600px] w-[600px] rounded-full bg-accent/8 blur-[150px]" />
        </>
      ) : null}

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "relative z-10 mx-auto w-full focus:outline-none",
          fullBleed
            ? "max-w-none"
            : oldGameRoom
              ? "flex max-w-[1600px] flex-col gap-6 px-4 pt-5 pb-12 md:px-8"
              : "max-w-[1440px] px-4 pt-10 pb-16 sm:px-6"
        )}
      >
        {children}
      </main>

      {oldGameRoom ? null : footer}
    </div>
  );
}
