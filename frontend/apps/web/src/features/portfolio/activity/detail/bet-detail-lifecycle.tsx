import * as React from "react";
import { TxStepper } from "@ssot/ui";

import { buildLifecycleSteps } from "./lifecycle";
import type { BetDetailFact } from "./types";

export function BetDetailLifecycle({
  state,
  facts
}: {
  state?: string | null;
  facts: readonly BetDetailFact[];
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
        Lifecycle proof
      </div>
      <h2 className="mt-2 text-2xl font-black text-fg">GameHub state</h2>
      <div className="mt-5">
        <TxStepper
          title="Ticket lifecycle"
          subtitle="Placement, randomness, and settlement remain independently inspectable."
          steps={buildLifecycleSteps(state)}
        />
      </div>
      <div className="mt-5 grid gap-3">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-0 px-4 py-3"
          >
            <span className="text-sm text-fg-muted">{fact.label}</span>
            <span className="break-all text-right font-mono text-sm font-bold text-fg">
              {fact.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
