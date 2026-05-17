import enCommon from "./locales/en/common.json";
import zhHansCommon from "./locales/zh-Hans/common.json";
import { defaultLocale, type AppLocale } from "./config";

type Messages = typeof enCommon;

const messages: Record<AppLocale, Messages> = {
  en: enCommon,
  "zh-Hans": zhHansCommon
};

export function getMessages(locale: AppLocale): Messages {
  return messages[locale] ?? messages[defaultLocale];
}
