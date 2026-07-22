"use client";

import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Banknote,
  Bus,
  Cat,
  Cloud,
  Coffee,
  Coins,
  CreditCard,
  Film,
  Gamepad2,
  Gift,
  Home,
  JapaneseYen,
  Landmark,
  Laptop,
  Music,
  Package,
  Pill,
  Plane,
  RefreshCw,
  Gem,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { CurrencyCode } from "@/lib/currency";

/** 规划 / 周期 / 愿望共用的图标 id（持久化用；兼容旧 emoji） */
export const APP_ICON_IDS = [
  "cloud",
  "film",
  "home",
  "bus",
  "banknote",
  "smartphone",
  "coffee",
  "gamepad",
  "cart",
  "pill",
  "music",
  "package",
  "credit-card",
  "wrench",
  "plane",
  "gift",
  "cat",
  "laptop",
  "gem",
  "landmark",
  "coins",
  "sparkles",
] as const;

export type AppIconId = (typeof APP_ICON_IDS)[number];

export const ACCOUNT_ICONS = [
  "credit-card",
  "smartphone",
  "landmark",
  "banknote",
  "coins",
  "package",
  "gift",
  "sparkles",
] as const satisfies readonly AppIconId[];

export const GOAL_ICONS = [
  "smartphone",
  "plane",
  "gamepad",
  "home",
  "gem",
  "bus",
  "laptop",
  "gift",
  "cat",
  "coffee",
] as const satisfies readonly AppIconId[];

export const RECURRING_ICONS = [
  "cloud",
  "film",
  "home",
  "bus",
  "banknote",
  "smartphone",
  "coffee",
  "gamepad",
  "cart",
  "pill",
  "music",
  "package",
  "credit-card",
  "wrench",
] as const satisfies readonly AppIconId[];

const ICON_MAP: Record<AppIconId, LucideIcon> = {
  cloud: Cloud,
  film: Film,
  home: Home,
  bus: Bus,
  banknote: Banknote,
  smartphone: Smartphone,
  coffee: Coffee,
  gamepad: Gamepad2,
  cart: ShoppingCart,
  pill: Pill,
  music: Music,
  package: Package,
  "credit-card": CreditCard,
  wrench: Wrench,
  plane: Plane,
  gift: Gift,
  cat: Cat,
  laptop: Laptop,
  gem: Gem,
  landmark: Landmark,
  coins: Coins,
  sparkles: Sparkles,
};

/** 旧 localStorage emoji → 新 icon id */
const EMOJI_TO_ICON: Record<string, AppIconId> = {
  "☁️": "cloud",
  "☁": "cloud",
  "🎬": "film",
  "🏠": "home",
  "🚌": "bus",
  "💵": "banknote",
  "💰": "banknote",
  "📱": "smartphone",
  "☕": "coffee",
  "🎮": "gamepad",
  "🛒": "cart",
  "🛍️": "cart",
  "💊": "pill",
  "🎵": "music",
  "📦": "package",
  "💳": "credit-card",
  "🛠️": "wrench",
  "🛠": "wrench",
  "✈️": "plane",
  "✈": "plane",
  "🎁": "gift",
  "🐱": "cat",
  "💻": "laptop",
  "💍": "gem",
  "🏦": "landmark",
  "🏧": "landmark",
  "🪙": "coins",
  "💎": "sparkles",
  "🚗": "bus",
};

export function isAppIconId(value: string): value is AppIconId {
  return Object.prototype.hasOwnProperty.call(ICON_MAP, value);
}

export function resolveAppIconId(
  value: string | undefined | null,
  fallback: AppIconId = "package",
): AppIconId {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed === "ring") return "gem";
  if (isAppIconId(trimmed)) return trimmed;
  return EMOJI_TO_ICON[trimmed] ?? fallback;
}

export function AppIcon({
  id,
  className = "size-4",
  strokeWidth = 2,
  ...rest
}: {
  id: string | undefined | null;
  className?: string;
  strokeWidth?: number;
} & Omit<LucideProps, "ref" | "className" | "strokeWidth">) {
  const resolved = resolveAppIconId(id);
  const Icon = ICON_MAP[resolved];
  return (
    <Icon aria-hidden className={className} strokeWidth={strokeWidth} {...rest} />
  );
}

export function CurrencyIcon({
  code,
  className = "size-4",
  strokeWidth = 2,
}: {
  code: CurrencyCode | string;
  className?: string;
  strokeWidth?: number;
}) {
  const map: Record<string, LucideIcon> = {
    HKD: Banknote,
    CNY: Coins,
    JPY: JapaneseYen,
    KRW: Coins,
  };
  const Icon = map[String(code).toUpperCase()] ?? Banknote;
  return <Icon aria-hidden className={className} strokeWidth={strokeWidth} />;
}

export function RecurringBadgeIcon({
  className = "size-3.5",
}: {
  className?: string;
}) {
  return <RefreshCw aria-hidden className={className} strokeWidth={2} />;
}

export function defaultRecurringIconId(
  direction: "income" | "expense",
): AppIconId {
  return direction === "income" ? "banknote" : "cloud";
}
