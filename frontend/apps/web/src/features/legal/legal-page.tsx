import Link from "next/link";
import * as React from "react";

import { cn } from "@ssot/ui";

import { LEGAL_NAV, type LegalPageContent } from "./content";

export function LegalPage({ content }: { content: LegalPageContent }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 py-10 md:py-14">
      <header className="grid gap-8 border-b border-border-soft pb-10 lg:grid-cols-[1fr_18rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-fg-subtle">{content.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold text-fg md:text-5xl">{content.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-fg-muted">{content.description}</p>
        </div>

        <nav aria-label="Legal pages" className="flex flex-wrap gap-2 lg:justify-end">
          {LEGAL_NAV.map((item) => {
            const active = item.slug === content.slug;

            return (
              <Link
                key={item.slug}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "border-brand/40 bg-brand-soft text-fg"
                    : "border-border-soft bg-surface-1 text-fg-muted hover:border-border hover:bg-surface-2 hover:text-fg"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-xl border border-border-soft bg-surface-1 p-5 shadow-e1">
            <h2 className="text-sm font-semibold text-fg">Key points</h2>
            <ul className="mt-4 space-y-3">
              {content.highlights.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-fg-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <article className="space-y-7">
          {content.sections.map((section) => (
            <section
              key={section.title}
              className="border-b border-border-soft pb-7 last:border-b-0"
            >
              <h2 className="text-xl font-semibold text-fg">{section.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-fg-muted">{section.body}</p>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
