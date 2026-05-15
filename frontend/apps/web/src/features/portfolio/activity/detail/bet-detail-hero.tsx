import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";

export function BetDetailHero({
  betId,
  gameLabel,
  stateLabel
}: {
  betId: string;
  gameLabel: string;
  stateLabel: string;
}) {
  return (
    <section>
      <Link
        href="/portfolio/activity"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-fg-muted transition hover:text-fg"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to ledger
      </Link>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-accent">
            <DocumentCheckIcon className="h-4 w-4" />
            Receipt dossier
          </div>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-fg md:text-5xl">
            {gameLabel} receipt.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-fg-muted">
            Stake, lifecycle proof, settlement facts, and eligible protocol actions stay attached to
            one auditable ticket surface.
          </p>
        </div>

        <div className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
            Ticket context
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-fg">#{betId}</div>
          <div className="mt-4 rounded-md border border-border-soft bg-surface-0 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
              Settlement state
            </div>
            <div className="mt-2 text-xl font-black text-brand">{stateLabel}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
