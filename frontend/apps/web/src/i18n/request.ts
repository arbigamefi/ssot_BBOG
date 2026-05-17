import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  ARBI_LOCALE_COOKIE,
  defaultLocale,
  localeFromAcceptLanguage,
  normalizeLocale,
  type AppLocale
} from "./config";
import { getMessages } from "./messages";

export async function resolveRequestLocale(): Promise<AppLocale> {
  const cookieLocale = normalizeLocale((await cookies()).get(ARBI_LOCALE_COOKIE)?.value);
  if (cookieLocale) return cookieLocale;

  const headerLocale = localeFromAcceptLanguage((await headers()).get("accept-language"));
  return headerLocale ?? defaultLocale;
}

export async function getRequestI18n() {
  const locale = await resolveRequestLocale();
  return {
    locale,
    messages: getMessages(locale)
  };
}

export default getRequestConfig(getRequestI18n);
