export const LOCALES = ["zh-CN", "zh-TW", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LANGUAGE_STORAGE_KEY = "cyberbookkeeper_language";

/** 选择器展示名（固定，不随界面语言变） */
export const LOCALE_OPTIONS: {
  code: Locale;
  label: string;
}[] = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
];

const LEGACY_MAP: Record<string, Locale> = {
  "简体中文": "zh-CN",
  "繁體中文": "zh-TW",
  "繁体中文": "zh-TW",
  English: "en",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  en: "en",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(value: unknown): Locale {
  if (typeof value !== "string") return "zh-CN";
  const trimmed = value.trim();
  if (isLocale(trimmed)) return trimmed;
  return LEGACY_MAP[trimmed] ?? "zh-CN";
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "zh-CN";
  try {
    return normalizeLocale(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "zh-CN";
  }
}

export function writeStoredLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function localeDisplayName(locale: Locale): string {
  return LOCALE_OPTIONS.find((o) => o.code === locale)?.label ?? locale;
}
