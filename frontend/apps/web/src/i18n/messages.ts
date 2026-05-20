import enCommon from "./locales/en/common.json";
import zhHansCommon from "./locales/zh-Hans/common.json";
import { defaultLocale, type AppLocale } from "./config";

export type AppMessages = typeof enCommon;

const messages: Record<AppLocale, AppMessages> = {
  en: enCommon,
  "zh-Hans": zhHansCommon
};

export function getMessages(locale: AppLocale): AppMessages {
  return messages[locale] ?? messages[defaultLocale];
}
