import * as React from "react";
import { useTranslations } from "next-intl";

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
          ? "flex min-h-[calc(100vh-8rem)] flex-col gap-4 pb-24 lg:pb-0"
          : "flex min-h-[calc(100vh-8rem)] flex-col gap-4"
      }
    >
      <header className="flex flex-col gap-3 border-b border-border-soft pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase text-accent">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            {t("casino.room.shell.liveModule")}
          </div>
          <h1 className="mt-1 text-4xl font-semibold text-fg md:text-5xl">{gameName}</h1>
        </div>

        <dl className="grid grid-cols-2 gap-3 md:min-w-72">
          <div className="rounded-lg border border-border-soft bg-surface-1 px-4 py-3 shadow-e1">
            <dt className="text-xs font-semibold uppercase text-fg-subtle">
              {t("casino.room.shell.maxBet")}
            </dt>
            <dd
              className={
                maxBetIsHint
                  ? "mt-1 text-sm font-semibold text-fg-muted"
                  : "mt-1 font-mono text-lg text-fg"
              }
            >
              {maxBet}
            </dd>
          </div>
          <div className="rounded-lg border border-border-soft bg-surface-1 px-4 py-3 shadow-e1">
            <dt className="text-xs font-semibold uppercase text-fg-subtle">
              {t("casino.room.shell.maxPayout")}
            </dt>
            <dd
              className={
                maxPayoutIsHint
                  ? "mt-1 text-sm font-semibold text-fg-muted"
                  : "mt-1 font-mono text-lg text-fg"
              }
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
              ? "order-1 relative min-h-[34rem] overflow-hidden bg-surface-0 lg:order-2 lg:min-h-0"
              : "pointer-events-none order-1 relative min-h-[34rem] overflow-hidden bg-surface-0 lg:order-2 lg:min-h-0"
          }
        >
          <div className="pointer-events-none absolute inset-0 bg-[url('/textures/noise.svg')] opacity-10 mix-blend-overlay" />
          {rightPaneContent}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-e1">
        {auditLedgerContent}
      </section>

      {mobileActionContent && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface-2/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-e3 backdrop-blur lg:hidden">
          <div className="mx-auto max-w-md">{mobileActionContent}</div>
        </div>
      )}
    </section>
  );
}
