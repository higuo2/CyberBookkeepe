"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createT,
  localeDisplayName,
  normalizeLocale,
  readStoredLocale,
  writeStoredLocale,
  type Locale,
  type MessageKey,
  type TranslateFn,
} from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
  ready: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readStoredLocale();
    setLocaleState(saved);
    document.documentElement.lang = saved;
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    writeStoredLocale(normalized);
    document.documentElement.lang = normalized;
  }, []);

  const t = useMemo(() => createT(locale), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return ctx;
}

export function useT(): TranslateFn {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** 安全版：Provider 外返回 zh-CN（极少用） */
export function useOptionalI18n() {
  return useContext(LocaleContext);
}

export type { Locale, MessageKey, TranslateFn };
export { localeDisplayName };
