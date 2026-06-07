"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, GlobeAltIcon, XMarkIcon } from "@heroicons/react/24/outline";

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

function useLocaleSelection() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const selectLocale = React.useCallback(
    (next: AppLocale) => {
      if (next === locale) return;
      setLocaleCookie(next);
      router.refresh();
    },
    [locale, router]
  );

  return { locale, selectLocale };
}

function LocaleFlagIcon({ locale, className }: { locale: AppLocale; className?: string }) {
  const classes = cn("h-5 w-5 overflow-hidden rounded-full", className);

  switch (locale) {
    case "zh-Hans":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={classes}>
          <rect width="24" height="24" className="fill-red-600" />
          <path
            d="M6 4.2 6.7 6.1h2L7.1 7.3l.6 1.9L6 8.1 4.3 9.2l.6-1.9L3.3 6.1h2L6 4.2Z"
            className="fill-yellow-300"
          />
          <circle cx="12.5" cy="5.2" r="0.9" className="fill-yellow-300" />
          <circle cx="14.5" cy="8" r="0.8" className="fill-yellow-300" />
          <circle cx="14.3" cy="11.6" r="0.8" className="fill-yellow-300" />
          <circle cx="11.8" cy="14.1" r="0.8" className="fill-yellow-300" />
        </svg>
      );
    case "pt-BR":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={classes}>
          <rect width="24" height="24" className="fill-green-600" />
          <path d="M12 4 21 12 12 20 3 12 12 4Z" className="fill-yellow-300" />
          <circle cx="12" cy="12" r="4.2" className="fill-blue-700" />
          <path
            d="M7.9 10.6c3 .8 5.7 1 8.2.3"
            className="stroke-white"
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case "ru":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={classes}>
          <rect width="24" height="8" className="fill-white" />
          <rect y="8" width="24" height="8" className="fill-blue-600" />
          <rect y="16" width="24" height="8" className="fill-red-600" />
        </svg>
      );
    case "tr":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={classes}>
          <rect width="24" height="24" className="fill-red-600" />
          <circle cx="10" cy="12" r="5" className="fill-white" />
          <circle cx="11.4" cy="12" r="4" className="fill-red-600" />
          <path
            d="m16.2 9.2.7 1.7 1.8.1-1.4 1.1.5 1.8-1.6-1-1.5 1 .4-1.8-1.4-1.1 1.8-.1.7-1.7Z"
            className="fill-white"
          />
        </svg>
      );
    case "en":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={classes}>
          <rect width="24" height="24" className="fill-white" />
          {Array.from({ length: 4 }).map((_, index) => (
            <rect key={index} y={index * 6} width="24" height="3" className="fill-red-600" />
          ))}
          <rect width="10.4" height="10.5" className="fill-blue-700" />
          <circle cx="2.5" cy="2.5" r="0.6" className="fill-white" />
          <circle cx="5.2" cy="2.5" r="0.6" className="fill-white" />
          <circle cx="7.9" cy="2.5" r="0.6" className="fill-white" />
          <circle cx="2.5" cy="5.2" r="0.6" className="fill-white" />
          <circle cx="5.2" cy="5.2" r="0.6" className="fill-white" />
          <circle cx="7.9" cy="5.2" r="0.6" className="fill-white" />
          <circle cx="2.5" cy="7.9" r="0.6" className="fill-white" />
          <circle cx="5.2" cy="7.9" r="0.6" className="fill-white" />
          <circle cx="7.9" cy="7.9" r="0.6" className="fill-white" />
        </svg>
      );
  }
}

function useBodyScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
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
  const { locale, selectLocale } = useLocaleSelection();
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
    selectLocale(next);
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

function LocaleOptionList({ onSelect, className }: { onSelect?: () => void; className?: string }) {
  const { locale, selectLocale } = useLocaleSelection();
  const t = useTranslations("locale");

  return (
    <div role="radiogroup" aria-label={t("label")} className={cn("grid gap-1", className)}>
      {appLocales.map((item) => {
        const active = item === locale;
        return (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              selectLocale(item);
              onSelect?.();
            }}
            title={localeLabels[item]}
            className={cn(
              "flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
              active
                ? "border-brand bg-brand-soft text-fg shadow-[inset_0_0_0_1px_hsl(var(--brand)/0.22)]"
                : "border-border-soft bg-surface-2 text-fg-muted hover:border-border hover:text-fg"
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 rounded-full ring-1 ring-white/15">
                <LocaleFlagIcon locale={item} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{localeLabels[item]}</span>
                <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-fg-subtle">
                  {localeShortLabels[item]}
                </span>
              </span>
            </span>
            {active && <CheckIcon className="h-4 w-4 shrink-0 text-brand" />}
          </button>
        );
      })}
    </div>
  );
}

export function LocaleSheetSwitcher({ className }: { className?: string }) {
  const { locale } = useLocaleSelection();
  const t = useTranslations("locale");
  const rootT = useTranslations();
  const [open, setOpen] = React.useState(false);
  useBodyScrollLock(open);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("label")}
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-left text-sm transition-colors hover:border-border hover:text-fg"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border-soft bg-surface-1 text-fg-muted">
            <GlobeAltIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {t("label")}
            </span>
            <span className="mt-0.5 flex items-center gap-2 truncate font-semibold text-fg">
              <LocaleFlagIcon locale={locale} className="h-4 w-4 shrink-0" />
              {localeLabels[locale]}
            </span>
          </span>
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-fg-subtle" />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[95] md:hidden" role="dialog" aria-modal="true">
              <button
                type="button"
                aria-label={rootT("nav.closeMenu")}
                className="absolute inset-0 bg-surface-0/70 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 max-h-[82svh] overflow-y-auto rounded-t-2xl border border-border-soft bg-surface-1 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-e3 animate-in slide-in-from-bottom">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                      <GlobeAltIcon className="h-3.5 w-3.5" />
                      {t("label")}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-fg">{localeLabels[locale]}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={rootT("nav.closeMenu")}
                    onClick={() => setOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-md border border-border-soft bg-surface-2 text-fg-muted transition-colors hover:text-fg"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <LocaleOptionList onSelect={() => setOpen(false)} />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
