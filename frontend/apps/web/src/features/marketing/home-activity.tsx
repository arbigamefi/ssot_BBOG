import * as React from "react";
import Link from "next/link";

import type { LandingActivity } from "./home-types";

export function HomeActivity({
  activity,
  copy
}: {
  activity: readonly LandingActivity[];
  copy: {
    eyebrow: string;
    title: string;
    viewAll: string;
    live: string;
    headers: {
      player: string;
      room: string;
      payout: string;
      age: string;
    };
    empty: string;
  };
}) {
  return (
    <section className="border-b border-border-soft bg-surface-1 py-16">
      <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
        <div
          className="relative overflow-hidden rounded-xl border border-border-soft p-6 shadow-e3"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
            }}
          />
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
                {copy.eyebrow}
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success motion-safe:animate-pulse" />
                  {copy.live}
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-fg">{copy.title}</h2>
            </div>
            <Link
              href="/portfolio/activity"
              className="text-sm font-bold text-brand transition-colors hover:text-brand-hover"
            >
              {copy.viewAll}
            </Link>
          </div>

          <div
            className="overflow-hidden rounded-lg border border-border-soft bg-surface-0/60"
            style={{ boxShadow: "inset 0 2px 12px rgb(0 0 0 / 0.4)" }}
          >
            <div className="grid grid-cols-[1fr_1.1fr_minmax(0,1.2fr)_72px] border-b border-border-soft px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
              <div>{copy.headers.player}</div>
              <div>{copy.headers.room}</div>
              <div className="text-right">{copy.headers.payout}</div>
              <div className="text-right">{copy.headers.age}</div>
            </div>
            {activity.length > 0 ? (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_1.1fr_minmax(0,1.2fr)_72px] items-center border-b border-border-soft px-4 py-3.5 text-sm last:border-b-0"
                >
                  <div className="font-mono text-fg-muted">{item.player}</div>
                  <div className="font-bold text-fg">{item.game}</div>
                  <div className="flex items-center justify-end gap-2 text-right">
                    {item.payout ? (
                      <>
                        {item.multiplier && (
                          <span className="font-mono text-[10px] font-bold text-accent">
                            {item.multiplier}
                          </span>
                        )}
                        <span
                          className={
                            item.isWin
                              ? "font-mono text-xs font-bold text-success"
                              : "font-mono text-xs text-fg-muted"
                          }
                        >
                          {item.payout}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-md border border-border-soft bg-surface-2 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-muted">
                        {item.state}
                      </span>
                    )}
                  </div>
                  <div className="text-right font-mono text-xs text-fg-subtle">{item.time}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-12 text-center text-sm text-fg-muted">{copy.empty}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
