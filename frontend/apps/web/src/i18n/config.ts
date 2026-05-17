export const ARBI_LOCALE_COOKIE = "arbi-locale";

export const appLocales = ["en", "zh-Hans"] as const;
export type AppLocale = (typeof appLocales)[number];

export const defaultLocale: AppLocale = "en";

export const localeLabels: Record<AppLocale, string> = {
  en: "English",
  "zh-Hans": "简体中文"
};

const localeAliases: Record<string, AppLocale> = {
  zh: "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-hans": "zh-Hans",
  "zh-sg": "zh-Hans"
};

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return appLocales.includes(value as AppLocale);
}

export function normalizeLocale(value: string | undefined | null): AppLocale | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (isAppLocale(normalized)) return normalized;
  return localeAliases[normalized.toLowerCase()];
}

export function localeFromAcceptLanguage(header: string | undefined | null): AppLocale | undefined {
  if (!header) return undefined;
  const candidates = header
    .split(",")
    .map((part) => part.trim().split(";")[0])
    .filter(Boolean);

  for (const candidate of candidates) {
    const exact = normalizeLocale(candidate);
    if (exact) return exact;
    const base = candidate?.split("-")[0];
    const baseMatch = normalizeLocale(base);
    if (baseMatch) return baseMatch;
  }
  return undefined;
}
