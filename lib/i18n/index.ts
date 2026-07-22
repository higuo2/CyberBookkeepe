import { en } from "@/lib/i18n/messages/en";
import { zhCN, type MessageKey, type Messages } from "@/lib/i18n/messages/zh-CN";
import { zhTW } from "@/lib/i18n/messages/zh-TW";
import type { Locale } from "@/lib/i18n/types";
import type { CurrencyCode } from "@/lib/currency";

export type { MessageKey, Messages, Locale };
export {
  LANGUAGE_STORAGE_KEY,
  LOCALE_OPTIONS,
  LOCALES,
  isLocale,
  localeDisplayName,
  normalizeLocale,
  readStoredLocale,
  writeStoredLocale,
} from "@/lib/i18n/types";

const CATALOG: Record<Locale, Messages> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  en,
};

export type TranslateFn = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export function getMessages(locale: Locale): Messages {
  return CATALOG[locale] ?? zhCN;
}

export function createT(locale: Locale): TranslateFn {
  const messages = getMessages(locale);
  return (key, vars) => {
    let text: string = messages[key] ?? zhCN[key] ?? String(key);
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

export function translateCurrencyLabel(
  code: CurrencyCode | string,
  t: TranslateFn,
): string {
  const key = `currency.${String(code).toUpperCase()}` as MessageKey;
  if (key in zhCN) return t(key);
  return String(code);
}

/** 给 AI prompt 用的语言说明 */
export function localePromptLabel(locale: Locale): string {
  if (locale === "zh-CN") return "简体中文";
  if (locale === "zh-TW") return "繁體中文";
  return "English";
}
