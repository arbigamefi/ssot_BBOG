import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CodeBracketSquareIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";

export function HomeProofSection() {
  return (
    <section className="bg-surface-0 py-20">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-10">
        <div className="rounded-md border border-border bg-surface-1 shadow-e2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-black text-fg">
              <CodeBracketSquareIcon className="h-5 w-5 text-brand" />
              settlement_trace.sol
            </div>
            <span className="font-mono text-xs text-fg-subtle">read-only proof surface</span>
          </div>
          <pre className="overflow-x-auto p-5 text-sm leading-7 text-fg-muted">
            <code>{`TicketPlaced -> RandomnessRequested
RandomnessFulfilled -> ModuleResolved
PayoutReserved -> BetFinalized
BankCredit -> PlayerClaimable`}</code>
          </pre>
        </div>

        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
            <ShieldCheckIcon className="h-4 w-4 text-brand" />
            Trust model
          </div>
          <h2 className="text-4xl font-black tracking-normal text-fg md:text-5xl">
            Transparent settlement rails.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-fg-muted">
            Custody, game modules, and randomness are separate surfaces. This makes the UI easier to
            rewrite without disturbing protocol correctness.
          </p>
          <Link
            href="/ops"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-fg-inverse transition hover:bg-brand-hover"
          >
            Open ops <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
