import * as React from "react";
import { useTranslations } from "next-intl";

import { StickyActionBar } from "../../../components/overlay";

export function GameRoomShell({
  gameName,
  maxBet,
  maxBetIsHint = false,
  maxPayout,
  maxPayoutIsHint = false,
  leftPaneContent,
  rightPaneContent,
  auditLedgerContent,
  mobileActionContent,
  isInteractive = false
}: {
  gameName: React.ReactNode;
  /** Live, asset-aware limits for the selected pool (chain-derived). */
  maxBet: string;
  maxBetIsHint?: boolean;
  maxPayout: string;
  maxPayoutIsHint?: boolean;
  leftPaneContent: React.ReactNode;
  rightPaneContent: React.ReactNode;
  auditLedgerContent: React.ReactNode;
  mobileActionContent?: React.ReactNode;
  isInteractive?: boolean;
}) {
  const t = useTranslations();

  return (
    <section
      className={
        mobileActionContent
          ? "flex min-h-[calc(100vh-8rem)] flex-col gap-4 pb-[calc(var(--agf-sticky-action-height,6rem)+1.5rem)] lg:pb-0"
          : "flex min-h-[calc(100vh-8rem)] flex-col gap-4"
      }
    >
      <header className="flex flex-col gap-2 border-b border-border-soft pb-2 md:flex-row md:items-end md:justify-between md:gap-4 md:pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent md:gap-3 md:text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            {t("casino.room.shell.liveModule")}
          </div>
          <h1 className="mt-1 truncate text-2xl font-semibold leading-tight text-fg md:text-5xl">
            {gameName}
          </h1>
        </div>

        <dl className="grid grid-cols-2 gap-3 border-t border-border-soft pt-2 md:min-w-[22rem] md:gap-4 md:border-t-0 md:pt-0">
          <div className="min-w-0 md:text-right">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-fg-subtle md:text-[10px] md:tracking-[0.12em]">
              {t("casino.room.shell.maxBet")}
            </dt>
            <dd
              className={
                maxBetIsHint
                  ? "mt-0.5 truncate text-xs font-semibold text-fg-muted md:mt-1 md:text-sm"
                  : "mt-0.5 truncate font-mono text-sm text-fg md:mt-1 md:text-lg"
              }
              title={typeof maxBet === "string" ? maxBet : undefined}
            >
              {maxBet}
            </dd>
          </div>
          <div className="min-w-0 md:text-right">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-fg-subtle md:text-[10px] md:tracking-[0.12em]">
              {t("casino.room.shell.maxPayout")}
            </dt>
            <dd
              className={
                maxPayoutIsHint
                  ? "mt-0.5 truncate text-xs font-semibold text-fg-muted md:mt-1 md:text-sm"
                  : "mt-0.5 truncate font-mono text-sm text-fg md:mt-1 md:text-lg"
              }
              title={typeof maxPayout === "string" ? maxPayout : undefined}
            >
              {maxPayout}
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid overflow-hidden rounded-xl border border-border bg-surface-1 shadow-e2 lg:min-h-[34rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="order-2 relative z-20 border-t border-border bg-surface-2 p-4 lg:order-1 lg:max-h-[calc(100vh-13rem)] lg:overflow-hidden lg:border-r lg:border-t-0">
          {leftPaneContent}
        </aside>

        <div
          data-tour="game-stage"
          className={
            isInteractive
              ? "order-1 relative min-h-0 overflow-hidden bg-surface-0 lg:order-2"
              : "pointer-events-none order-1 relative min-h-0 overflow-hidden bg-surface-0 lg:order-2"
          }
        >
          <div className="pointer-events-none absolute inset-0 bg-[url('/textures/noise.svg')] opacity-10 mix-blend-overlay" />
          {rightPaneContent}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-e1">
        {auditLedgerContent}
      </section>

      {mobileActionContent && <StickyActionBar>{mobileActionContent}</StickyActionBar>}
    </section>
  );
}
