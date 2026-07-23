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

export const FONT_SETTINGS_KEY = "app_font_settings";

export type FontSize = "small" | "medium" | "large";
export type FontStyle = "system" | "rounded" | "serif";

export type FontSettings = {
  fontSize: FontSize;
  fontStyle: FontStyle;
};

export const FONT_SIZE_SCALE: Record<FontSize, number> = {
  small: 0.9,
  medium: 1,
  large: 1.1,
};

export const FONT_FAMILY_STACK: Record<FontStyle, string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif',
  rounded:
    'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", "Yuanti SC", "STYuanti", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  /** Noto Serif SC via Google Fonts link; Songti/STSong for iOS native */
  serif:
    '"Noto Serif SC", "Songti SC", "STSong", "宋体-简", "Source Han Serif SC", "Noto Serif CJK SC", SimSun, Georgia, "Times New Roman", serif',
};

const DEFAULT_SETTINGS: FontSettings = {
  fontSize: "medium",
  fontStyle: "rounded",
};

type FontContextValue = {
  settings: FontSettings;
  fontSize: FontSize;
  fontStyle: FontStyle;
  setFontSize: (size: FontSize) => void;
  setFontStyle: (style: FontStyle) => void;
  setSettings: (next: Partial<FontSettings>) => void;
  ready: boolean;
};

const FontContext = createContext<FontContextValue | null>(null);

function isFontSize(value: unknown): value is FontSize {
  return value === "small" || value === "medium" || value === "large";
}

function isFontStyle(value: unknown): value is FontStyle {
  return value === "system" || value === "rounded" || value === "serif";
}

function normalizeSettings(raw: unknown): FontSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const obj = raw as Record<string, unknown>;
  return {
    fontSize: isFontSize(obj.fontSize) ? obj.fontSize : DEFAULT_SETTINGS.fontSize,
    fontStyle: isFontStyle(obj.fontStyle)
      ? obj.fontStyle
      : DEFAULT_SETTINGS.fontStyle,
  };
}

function readStoredSettings(): FontSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(FONT_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeStoredSettings(settings: FontSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FONT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}

function applyFontToDocument(settings: FontSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const scale = FONT_SIZE_SCALE[settings.fontSize];
  root.style.setProperty("--font-scale", String(scale));
  root.dataset.fontSize = settings.fontSize;
  root.dataset.fontStyle = settings.fontStyle;
  root.classList.remove(
    "font-app-system",
    "font-app-rounded",
    "font-app-serif",
  );
  root.classList.add(`font-app-${settings.fontStyle}`);
  const stack = FONT_FAMILY_STACK[settings.fontStyle];
  root.style.fontFamily = stack;
  document.body.style.fontFamily = stack;
}

export function FontProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<FontSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readStoredSettings();
    setSettingsState(saved);
    applyFontToDocument(saved);
    setReady(true);
  }, []);

  const commit = useCallback((updater: (prev: FontSettings) => FontSettings) => {
    setSettingsState((prev) => {
      const next = updater(prev);
      writeStoredSettings(next);
      applyFontToDocument(next);
      return next;
    });
  }, []);

  const setFontSize = useCallback(
    (fontSize: FontSize) => {
      commit((prev) => ({ ...prev, fontSize }));
    },
    [commit],
  );

  const setFontStyle = useCallback(
    (fontStyle: FontStyle) => {
      commit((prev) => ({ ...prev, fontStyle }));
    },
    [commit],
  );

  const setSettings = useCallback(
    (partial: Partial<FontSettings>) => {
      commit((prev) => ({
        fontSize: partial.fontSize ?? prev.fontSize,
        fontStyle: partial.fontStyle ?? prev.fontStyle,
      }));
    },
    [commit],
  );

  const value = useMemo(
    () => ({
      settings,
      fontSize: settings.fontSize,
      fontStyle: settings.fontStyle,
      setFontSize,
      setFontStyle,
      setSettings,
      ready,
    }),
    [settings, setFontSize, setFontStyle, setSettings, ready],
  );

  return (
    <FontContext.Provider value={value}>{children}</FontContext.Provider>
  );
}

export function useFont() {
  const ctx = useContext(FontContext);
  if (!ctx) {
    throw new Error("useFont must be used within FontProvider");
  }
  return ctx;
}

/**
 * Canvas 需显式设置 font；从当前应用字体外观读取，避免写死 system-ui。
 */
export function getAppCanvasFont(
  weight: number | string,
  sizePx: number,
): string {
  if (typeof document === "undefined") {
    return `${weight} ${sizePx}px ${FONT_FAMILY_STACK.rounded}`;
  }
  const computed = getComputedStyle(document.documentElement).fontFamily;
  const rawStyle = document.documentElement.dataset.fontStyle;
  const style = isFontStyle(rawStyle) ? rawStyle : "rounded";
  const family = computed?.trim() || FONT_FAMILY_STACK[style];
  return `${weight} ${sizePx}px ${family}`;
}
