"use client";

import * as React from "react";
import type { I18nKey, I18nPack } from "./keys";
import { en } from "./en";

export type I18nContextValue = {
  /** Current locale identifier (e.g. "en", "zh"). */
  locale: string;
  /** Look up a translated string by key. Returns the key itself if missing. */
  t: (key: I18nKey) => string;
  /** Switch locale at runtime (triggers re-render of all consumers). */
  setLocale: (locale: string) => void;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

/** Registry of loaded packs. English is always available. */
const packs: Record<string, I18nPack> = { en };

/**
 * Register additional locale packs at boot time.
 *
 * @example
 * ```ts
 * import { registerI18nPack } from "@ssot/ui/i18n";
 * import { zh } from "./zh";
 * registerI18nPack("zh", zh);
 * ```
 */
export function registerI18nPack(locale: string, pack: I18nPack): void {
  packs[locale] = pack;
}

export function I18nProvider({
  children,
  defaultLocale = "en",
}: {
  children: React.ReactNode;
  defaultLocale?: string;
}) {
  const [locale, setLocale] = React.useState(defaultLocale);

  const t = React.useCallback(
    (key: I18nKey): string => {
      const pack = packs[locale] ?? packs.en!;
      return pack[key] ?? key;
    },
    [locale]
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({ locale, t, setLocale }),
    [locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    // Fallback: return English pack without provider (graceful degradation)
    return {
      locale: "en",
      t: (key: I18nKey) => en[key] ?? key,
      setLocale: () => {},
    };
  }
  return ctx;
}
