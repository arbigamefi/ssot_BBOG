"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

/**
 * Player help center. Questions live in i18n under `support.faq.items` as an
 * array of `{ q, a }`. Rendered as an accessible accordion (button + region).
 */
type FaqItem = { q: string; a: string };

export function FaqAccordion() {
  const t = useTranslations("support");
  const items = readFaqItems(t);
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
      <header className="border-b border-border-soft pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg-subtle">
          {t("faq.eyebrow")}
        </p>
        <h1 className="mt-3 text-4xl font-bold text-fg md:text-5xl">{t("faq.title")}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-fg-muted">{t("faq.description")}</p>
      </header>

      <ul className="mt-6 flex flex-col gap-2">
        {items.map((item, index) => {
          const expanded = open === index;
          return (
            <li
              key={index}
              className="overflow-hidden rounded-xl border border-border-soft bg-surface-1"
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
              >
                <span className="text-sm font-semibold text-fg">{item.q}</span>
                <ChevronDownIcon
                  className={cn(
                    "h-5 w-5 shrink-0 text-fg-muted transition-transform",
                    expanded && "rotate-180"
                  )}
                />
              </button>
              {expanded && (
                <div className="border-t border-border-soft px-5 py-4">
                  <p className="whitespace-pre-line text-sm leading-6 text-fg-muted">{item.a}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Contact card — the human escape hatch. */}
      <ContactCard t={t} />
    </div>
  );
}

function ContactCard({ t }: { t: ReturnType<typeof useTranslations> }) {
  const channels: Array<{ label: string; href: string; external?: boolean }> = [
    { label: t("contact.discord"), href: "https://discord.gg/arbigamefi", external: true },
    { label: t("contact.email"), href: "mailto:support@arbigamefi.com" },
    { label: t("contact.status"), href: "/status" },
    {
      label: t("contact.docs"),
      href: "https://github.com/arbigamefi/ssot_BBOG/tree/master/docs",
      external: true
    }
  ];

  return (
    <section className="mt-10 rounded-2xl border border-border-soft bg-surface-1 p-6 shadow-e1">
      <h2 className="text-lg font-bold text-fg">{t("contact.title")}</h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{t("contact.description")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {channels.map((channel) => (
          <a
            key={channel.label}
            href={channel.href}
            {...(channel.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
            className="rounded-md border border-border-soft bg-surface-2 px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand/40 hover:text-brand"
          >
            {channel.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function readFaqItems(t: ReturnType<typeof useTranslations>): FaqItem[] {
  try {
    // Items live at `support.items` (the hook is scoped to `support`), not
    // `support.faq.items`.
    const raw = t.raw("items");
    if (Array.isArray(raw)) return raw as FaqItem[];
  } catch {
    // fall through
  }
  return [];
}
