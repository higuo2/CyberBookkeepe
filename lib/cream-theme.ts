/** Shared Quiet Luxury / parchment theme snippets + Can Store themes */

const CARD =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xs";

export const cream = {
  page: "h-full overflow-y-auto overscroll-contain px-5 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y",
  eyebrow: "text-xs font-medium text-ink-muted",
  title: "mt-1 text-2xl font-bold tracking-tight text-ink",
  subtitle: "mt-1 text-xs text-ink-muted",
  card: `${CARD} p-5`,
  cardSoft: `${CARD} p-4`,
  iconBtn:
    "grid size-11 place-items-center rounded-full border border-[var(--cream-border)] bg-[var(--cream-card)] text-ink-muted shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  field:
    "h-12 w-full rounded-2xl border border-[var(--cream-border)] bg-[var(--cream-divide)] px-3 text-sm text-ink-body outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10",
  primaryBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary text-sm font-semibold text-white shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  mintBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#E8EFE9] text-sm font-semibold text-[#5B7A66] shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  muted: "text-ink-muted",
  ink: "text-ink-body",
  accent: "text-brand-primary",
  expense: "text-expense",
  income: "text-income",
  danger: "text-danger",
  spinner: "text-brand-primary",
  segment: "grid grid-cols-2 gap-2 rounded-2xl bg-[var(--cream-divide)] p-1.5",
  warmPanel: "rounded-2xl bg-[var(--cream-divide)] p-3",
  border: "border-[var(--cream-border)]",
  navActive: "text-ink",
  navIdle: "text-ink-muted",
  hex: {
    brandPrimary: "#C86235",
    expense: "#B8785C",
    income: "#5B7A66",
    danger: "#A87870",
    creamBg: "#F6F4EE",
    creamBgSoft: "#FBF9F5",
    creamCard: "#FFFFFF",
    creamBorder: "#EAE5D9",
    creamDivide: "#F0ECE1",
    ink: "#2C2420",
    inkBody: "#5A5046",
    inkMuted: "#9C9285",
  },
} as const;

export type ThemeId = "cream" | "titanium" | "cyber" | "matcha" | "sky";

export type ThemeTokens = {
  bg: string;
  bgSoft: string;
  card: string;
  primary: string;
  ink: string;
  inkBody: string;
  inkMuted: string;
  border: string;
  divide: string;
  scheme: "light" | "dark";
};

export type ThemeConfig = {
  id: ThemeId;
  name: string;
  cost: number;
  badge?: string;
  description: string;
  previewColors: {
    bg: string;
    card: string;
    primary: string;
    text: string;
    border: string;
  };
  tokens: ThemeTokens;
};

/** cream = 现有 Quiet Luxury，不改默认观感 */
export const STORE_THEMES: ThemeConfig[] = [
  {
    id: "cream",
    name: "焦糖奶油",
    cost: 0,
    description: "原生治愈风格，温馨暖调",
    previewColors: {
      bg: "#F6F4EE",
      card: "#FFFFFF",
      primary: "#C86235",
      text: "#2C2420",
      border: "#EAE5D9",
    },
    tokens: {
      bg: "#F6F4EE",
      bgSoft: "#FBF9F5",
      card: "#FFFFFF",
      primary: "#C86235",
      ink: "#2C2420",
      inkBody: "#5A5046",
      inkMuted: "#9C9285",
      border: "#EAE5D9",
      divide: "#F0ECE1",
      scheme: "light",
    },
  },
  {
    id: "titanium",
    name: "钛空极夜",
    cost: 1,
    badge: "OLED 护眼",
    description: "针对 iPhone OLED 极致纯黑优化，省电沉浸",
    previewColors: {
      bg: "#000000",
      card: "#141416",
      primary: "#0A84FF",
      text: "#F5F5F7",
      border: "rgba(255,255,255,0.12)",
    },
    tokens: {
      bg: "#000000",
      bgSoft: "#0A0A0C",
      card: "#141416",
      primary: "#0A84FF",
      ink: "#F5F5F7",
      inkBody: "#C7C7CC",
      inkMuted: "#8E8E93",
      border: "rgba(255,255,255,0.12)",
      divide: "#1C1C1E",
      scheme: "dark",
    },
  },
  {
    id: "cyber",
    name: "赛博霓虹",
    cost: 2,
    badge: "极客专属",
    description: "暗夜霓虹碰撞，尽显赛博朋克态度",
    previewColors: {
      bg: "#0F0E17",
      card: "#1B1A26",
      primary: "#FF007F",
      text: "#FFFFFE",
      border: "rgba(0,240,255,0.25)",
    },
    tokens: {
      bg: "#0F0E17",
      bgSoft: "#12111C",
      card: "#1B1A26",
      primary: "#FF007F",
      ink: "#FFFFFE",
      inkBody: "#E8E6F0",
      inkMuted: "#9B97B0",
      border: "rgba(0,240,255,0.25)",
      divide: "#252433",
      scheme: "dark",
    },
  },
  {
    id: "matcha",
    name: "抹茶白桃",
    cost: 3,
    description: "柔和舒缓的植物色彩，舒缓账单压力",
    previewColors: {
      bg: "#F2F7F4",
      card: "#FFFFFF",
      primary: "#83C5BE",
      text: "#2B4C3F",
      border: "rgba(131,197,190,0.2)",
    },
    tokens: {
      bg: "#F2F7F4",
      bgSoft: "#F7FBF8",
      card: "#FFFFFF",
      primary: "#83C5BE",
      ink: "#2B4C3F",
      inkBody: "#3D5C50",
      inkMuted: "#7A9A8C",
      border: "rgba(131,197,190,0.35)",
      divide: "#E4EFE8",
      scheme: "light",
    },
  },
  {
    id: "sky",
    name: "凛空蔚蓝",
    cost: 4,
    badge: "旗舰 iOS",
    description: "苹果级冰爽清澈感，通透空气视觉",
    previewColors: {
      bg: "#F0F6FC",
      card: "#FFFFFF",
      primary: "#007AFF",
      text: "#0F172A",
      border: "rgba(0,122,255,0.15)",
    },
    tokens: {
      bg: "#F0F6FC",
      bgSoft: "#F7FAFE",
      card: "#FFFFFF",
      primary: "#007AFF",
      ink: "#0F172A",
      inkBody: "#334155",
      inkMuted: "#94A3B8",
      border: "rgba(0,122,255,0.2)",
      divide: "#E2EBF5",
      scheme: "light",
    },
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    value === "cream" ||
    value === "titanium" ||
    value === "cyber" ||
    value === "matcha" ||
    value === "sky"
  );
}

export function getThemeConfig(id: ThemeId): ThemeConfig {
  return STORE_THEMES.find((t) => t.id === id) ?? STORE_THEMES[0];
}
