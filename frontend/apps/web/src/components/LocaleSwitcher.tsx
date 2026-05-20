"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { cn } from "@ssot/ui";
import { ARBI_LOCALE_COOKIE, appLocales, localeLabels, type AppLocale } from "../i18n/config";

function setLocaleCookie(locale: AppLocale) {
  document.cookie = `${ARBI_LOCALE_COOKIE}=${encodeURIComponent(
    locale
  )}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations("locale");

  return (
    <div
      aria-label={t("label")}
      className={cn(
        "flex items-center rounded-full border border-border-soft bg-surface-2 p-1",
        compact ? "gap-0.5" : "gap-1"
      )}
    >
      {appLocales.map((item) => {
        const active = item === locale;
        return (
          <button
            key={item}
            type="button"
            title={localeLabels[item]}
            aria-pressed={active}
            onClick={() => {
              setLocaleCookie(item);
              router.refresh();
            }}
            className={cn(
              "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
              active ? "bg-fg text-fg-inverse" : "text-fg-subtle hover:text-fg"
            )}
          >
            {compact
              ? item === "zh-Hans"
                ? "中文"
                : "EN"
              : item === "zh-Hans"
                ? t("zhHans")
                : t("en")}
          </button>
        );
      })}
    </div>
  );
}
