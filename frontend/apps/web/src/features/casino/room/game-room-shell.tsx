import * as React from "react";
import { useTranslations } from "next-intl";

export function GameRoomShell({
  gameName,
  houseEdge,
  maxPayout,
  leftPaneContent,
  rightPaneContent,
  auditLedgerContent,
  isInteractive = false
}: {
  gameName: React.ReactNode;
  houseEdge: string;
  maxPayout: string;
  leftPaneContent: React.ReactNode;
  rightPaneContent: React.ReactNode;
  auditLedgerContent: React.ReactNode;
  isInteractive?: boolean;
}) {
  const t = useTranslations();

  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <header className="flex flex-col gap-3 border-b border-border-soft pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase text-accent">
            <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-glow" />
            {t("casino.room.shell.liveModule")}
          </div>
          <h1 className="mt-1 text-4xl font-semibold text-fg md:text-5xl">{gameName}</h1>
        </div>

        <dl className="grid grid-cols-2 gap-3 md:min-w-72">
          <div className="rounded-lg border border-border-soft bg-surface-1 px-4 py-3 shadow-e1">
            <dt className="text-xs font-semibold uppercase text-fg-subtle">
              {t("casino.room.shell.houseEdge")}
            </dt>
            <dd className="mt-1 font-mono text-lg text-accent">{houseEdge}</dd>
          </div>
          <div className="rounded-lg border border-border-soft bg-surface-1 px-4 py-3 shadow-e1">
            <dt className="text-xs font-semibold uppercase text-fg-subtle">
              {t("casino.room.shell.maxPayout")}
            </dt>
            <dd className="mt-1 font-mono text-lg text-fg">{maxPayout}</dd>
          </div>
        </dl>
      </header>

      <div className="grid overflow-hidden rounded-xl border border-border bg-surface-1 shadow-e2 lg:min-h-[35rem] lg:grid-cols-[28rem_1fr]">
        <aside className="relative z-20 border-b border-border bg-surface-2 p-4 lg:border-b-0 lg:border-r">
          {leftPaneContent}
        </aside>

        <div
          className={
            isInteractive
              ? "relative min-h-[34rem] overflow-hidden bg-surface-0 lg:min-h-0"
              : "pointer-events-none relative min-h-[34rem] overflow-hidden bg-surface-0 lg:min-h-0"
          }
        >
          <div className="pointer-events-none absolute inset-0 bg-[url('/textures/noise.svg')] opacity-10 mix-blend-overlay" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-soft blur-3xl" />
          {rightPaneContent}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-e1">
        {auditLedgerContent}
      </section>
    </section>
  );
}
