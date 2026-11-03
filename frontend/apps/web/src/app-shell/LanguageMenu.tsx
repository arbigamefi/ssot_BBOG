"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

import {
  ARBI_LOCALE_COOKIE,
  appLocales,
  localeLabels,
  localeShortLabels,
  type AppLocale
} from "../i18n/config";
import { FOCUS_ON_CARBON, MENU_PANEL, MENU_ROW } from "./site-nav";
import { useHeaderMenu } from "./use-header-menu";

/** Stores the reader's language in the locale cookie and renders the page again in it. */
function useSelectLocale() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const select = React.useCallback(
    (next: AppLocale) => {
      if (next === locale) return;
      document.cookie = `${ARBI_LOCALE_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    },
    [locale, router]
  );
  return { locale, select };
}

/** The languages as a list of buttons, each named in its own language. */
export function LanguageList({ onSelect }: { onSelect?: () => void }) {
  const { locale, select } = useSelectLocale();
  return (
    <ul>
      {appLocales.map((item) => (
        <li key={item}>
          <button
            type="button"
            lang={item}
            aria-current={item === locale ? "true" : undefined}
            onClick={() => {
              select(item);
              onSelect?.();
            }}
            className={`${MENU_ROW} justify-between aria-[current]:font-semibold`}
          >
            {localeLabels[item]}
            {item === locale ? <span aria-hidden className="size-2 rounded-full bg-paper" /> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The header's language control: the current language's short name opens the list. */
export function LanguageMenu() {
  const t = useTranslations("locale");
  const locale = useLocale() as AppLocale;
  const menu = useHeaderMenu();
  return (
    <div ref={menu.rootRef} onBlur={menu.onBlur} className="relative">
      <button
        {...menu.triggerProps}
        aria-label={`${t("label")}: ${localeLabels[locale]}`}
        className={`inline-flex min-h-11 items-center gap-1 rounded-print px-2 text-on-carbon-muted hover:text-paper aria-expanded:text-paper ${FOCUS_ON_CARBON}`}
      >
        {localeShortLabels[locale]}
        <ChevronDownIcon aria-hidden className="size-4" />
      </button>
      <div id={menu.panelId} hidden={!menu.open} className={`${MENU_PANEL} w-56`}>
        <LanguageList onSelect={menu.close} />
      </div>
    </div>
  );
}
