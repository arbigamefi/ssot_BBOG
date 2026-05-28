"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

import { cn } from "@ssot/ui";
import {
  ARBI_LOCALE_COOKIE,
  appLocales,
  localeLabels,
  localeShortLabels,
  type AppLocale
} from "../i18n/config";

function setLocaleCookie(locale: AppLocale) {
  document.cookie = `${ARBI_LOCALE_COOKIE}=${encodeURIComponent(
    locale
  )}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Language picker as a compact globe-icon dropdown — the conventional web
 * pattern. Scales cleanly to N languages without eating header width.
 * `compact` (header) shows only the globe + short code; otherwise the active
 * full label is shown too. `menuPlacement="top"` opens upward (footer use).
 */
export function LocaleSwitcher({
  compact = false,
  menuPlacement = "bottom"
}: {
  compact?: boolean;
  menuPlacement?: "top" | "bottom";
}) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations("locale");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (next: AppLocale) => {
    setOpen(false);
    if (next === locale) return;
    setLocaleCookie(next);
    router.refresh();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={t("label")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={localeLabels[locale]}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-soft bg-surface-2 px-3 py-1.5 text-xs font-bold text-fg-muted transition-colors hover:text-fg"
      >
        <GlobeAltIcon className="h-4 w-4" />
        <span>{compact ? localeShortLabels[locale] : localeLabels[locale]}</span>
        <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("label")}
          className={cn(
            "absolute right-0 z-50 w-44 overflow-hidden rounded-xl border border-border-soft bg-surface-1 p-1 shadow-e3",
            menuPlacement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {appLocales.map((item) => {
            const active = item === locale;
            return (
              <button
                key={item}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => select(item)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-brand-soft font-semibold text-fg"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-fg-subtle">
                    {localeShortLabels[item]}
                  </span>
                  {localeLabels[item]}
                </span>
                {active && <CheckIcon className="h-4 w-4 text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
