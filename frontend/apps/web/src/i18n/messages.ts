import enCommon from "./locales/en/common.json";
import zhHansCommon from "./locales/zh-Hans/common.json";
import ptBRCommon from "./locales/pt-BR/common.json";
import ruCommon from "./locales/ru/common.json";
import trCommon from "./locales/tr/common.json";
import { defaultLocale, type AppLocale } from "./config";

export type AppMessages = typeof enCommon;

/**
 * Deep-merge a (possibly partial) locale file over the English base.
 *
 * This is what makes incremental localization safe: a locale file only needs
 * to contain the namespaces/keys that have been translated. Anything missing
 * resolves to the English string, so next-intl never throws on a missing key
 * and untranslated surfaces degrade gracefully instead of crashing.
 *
 * Rules:
 *  - objects merge key-by-key against the English shape (English is the
 *    canonical key set — extra keys in a locale file are ignored);
 *  - arrays are taken wholesale from the locale when present (translators
 *    supply a complete localized list), else English;
 *  - empty strings fall back to English (treated as "not translated yet").
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (override == null) return base;
  if (Array.isArray(base)) {
    return (Array.isArray(override) && override.length > 0 ? override : base) as T;
  }
  if (base !== null && typeof base === "object") {
    const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    const ov = override as Record<string, unknown>;
    for (const key of Object.keys(result)) {
      if (key in ov) result[key] = deepMerge(result[key], ov[key]);
    }
    return result as T;
  }
  return (typeof override === "string" && override.length > 0 ? override : base) as T;
}

const partialMessages: Record<AppLocale, unknown> = {
  en: enCommon,
  "zh-Hans": zhHansCommon,
  "pt-BR": ptBRCommon,
  ru: ruCommon,
  tr: trCommon
};

const mergedCache = new Map<AppLocale, AppMessages>();

export function getMessages(locale: AppLocale): AppMessages {
  if (locale === defaultLocale) return enCommon;
  const cached = mergedCache.get(locale);
  if (cached) return cached;
  const merged = deepMerge(enCommon, partialMessages[locale] ?? {});
  mergedCache.set(locale, merged);
  return merged;
}
