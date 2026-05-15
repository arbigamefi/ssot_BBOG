import * as React from "react";

import { shortHex } from "./format";
import type { BetDetailFact } from "./types";

export function BetDetailFacts({ facts }: { facts: readonly BetDetailFact[] }) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border px-5 py-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          Execution facts
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">Receipt matrix</h2>
      </div>
      <div className="grid gap-3 p-5">
        {facts.map((fact) => (
          <FactRow key={fact.label} fact={fact} />
        ))}
      </div>
    </section>
  );
}

function FactRow({ fact }: { fact: BetDetailFact }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-0 px-4 py-3">
      <div className="text-sm text-fg-muted">{fact.label}</div>
      <div className="inline-flex items-center gap-2 text-right font-mono text-sm font-bold text-fg">
        {fact.href && fact.value !== "—" ? (
          <a
            href={fact.href}
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:text-brand-hover"
          >
            {fact.value}
          </a>
        ) : (
          <span>{fact.value}</span>
        )}
        {fact.copyValue && fact.value !== "—" ? <CopyAction value={fact.copyValue} /> : null}
      </div>
    </div>
  );
}

function CopyAction({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, [value]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="rounded-sm border border-border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-fg-muted transition hover:text-fg"
      title={`Copy ${shortHex(value)}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
