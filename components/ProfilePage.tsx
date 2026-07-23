"use client";

import { useEffect, useState, type MouseEvent } from "react";
import {
  ChevronRight,
  Cloud,
  Coins,
  Download,
  Flame,
  Gamepad2,
  Globe,
  Heart,
  Info,
  LoaderCircle,
  Mail,
  Palette,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { CatAvatar } from "@/components/CatAvatar";
import { CanBalanceSheet } from "@/components/CanBalanceSheet";
import { CheckinRulesModal } from "@/components/CheckinRulesModal";
import { ConfirmDialog, SettingsRow } from "@/components/ConfirmDialog";
import { CurrencyIcon } from "@/components/AppIcons";
import { GameArcadeDrawer } from "@/components/GameArcadeDrawer";
import { ThemeStoreSheet } from "@/components/ThemeStoreSheet";
import { TipRiverSheet } from "@/components/TipRiverSheet";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  CURRENCY_CODES,
  readDefaultCurrency,
  writeDefaultCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import { exportTransactionsToXlsx } from "@/lib/export";
import { getSupabase } from "@/lib/supabase";
import {
  formatSupabaseError,
  queryTransactions,
} from "@/lib/transactions-query";
import {
  formatSyncClock,
  readCompanionDays,
  readLastCloudSyncAt,
  touchLastCloudSync,
} from "@/lib/settings-meta";
import { useI18n } from "@/components/LocaleProvider";
import {
  LOCALE_OPTIONS,
  createT,
  localeDisplayName,
  translateCurrencyLabel,
  writeStoredLocale,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";
import {
  FONT_FAMILY_STACK,
  useFont,
  type FontSize,
  type FontStyle,
} from "@/context/FontContext";
import {
  CAN_STATE_EVENT,
  completeMilestone,
  readCanState,
  themeDisplayName,
} from "@/lib/can-system";
import { clearGameArcadeLocal } from "@/lib/game-arcade";

const FEEDBACK_EMAIL = "guokaier1478@gmail.com";

const SECTION_LABEL =
  "mb-2 px-1 text-caption font-semibold tracking-wide text-[#7A6B5C]";

/** 分组图标淡底：外观 / 工坊 / 数据 / 关于 */
const ICON_BG = {
  look: "bg-[#F3EEE6]",
  workshop: "bg-[#FFF0E6]",
  data: "bg-[#EBF7F0]",
  about: "bg-[#F0EEF6]",
} as const;

const RIVER_QUOTE_KEYS = [
  "settings.river.quote0",
  "settings.river.quote1",
  "settings.river.quote2",
  "settings.river.quote3",
  "settings.river.quote4",
  "settings.river.quote5",
] as const satisfies readonly MessageKey[];

const RIVER_POKE_KEYS = [
  "settings.river.poke0",
  "settings.river.poke1",
  "settings.river.poke2",
  "settings.river.poke3",
] as const satisfies readonly MessageKey[];

const PLANNER_STORAGE_KEYS = [
  "cyberbookkeeper_planner_accounts",
  "cyberbookkeeper_planner_ledger",
  "cyberbookkeeper_planner_goals",
  "cyberbookkeeper_planner_subs",
  "cyberbookkeeper_budget_spend_mode",
  "cyberbookkeeper_monthly_budget",
  "cyberbookkeeper_demo_recurring_purged_v2",
  "cyberbookkeeper_demo_goals_purged_v1",
  "cyberbookkeeper_demo_rec_tx_purged_v1",
  "cyberbookkeeper_chat_user_id",
  "cyberbookkeeper_can_economy_v1",
  "cyberbookkeeper_current_theme",
  "cyberbookkeeper_last_cloud_sync_at",
];

const FONT_STYLE_OPTIONS: {
  code: FontStyle;
  labelKey: MessageKey;
  hintKey?: MessageKey;
}[] = [
  { code: "system", labelKey: "settings.fontStyle.system" },
  {
    code: "rounded",
    labelKey: "settings.fontStyle.rounded",
    hintKey: "settings.fontStyle.roundedHint",
  },
  {
    code: "serif",
    labelKey: "settings.fontStyle.serif",
    hintKey: "settings.fontStyle.serifHint",
  },
];

const FONT_SIZE_OPTIONS: { code: FontSize; labelKey: MessageKey }[] = [
  { code: "small", labelKey: "settings.fontSize.small" },
  { code: "medium", labelKey: "settings.fontSize.medium" },
  { code: "large", labelKey: "settings.fontSize.large" },
];

export function ProfilePage() {
  const { locale, setLocale, t } = useI18n();
  const { fontSize, fontStyle, setFontSize, setFontStyle } = useFont();
  const [currency, setCurrency] = useState<CurrencyCode>("HKD");
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);
  const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);
  const [isFontStyleSheetOpen, setIsFontStyleSheetOpen] = useState(false);
  const [isThemeStoreOpen, setIsThemeStoreOpen] = useState(false);
  const [isTipRiverOpen, setIsTipRiverOpen] = useState(false);
  const [isCanDrawerOpen, setIsCanDrawerOpen] = useState(false);
  const [isArcadeOpen, setIsArcadeOpen] = useState(false);
  const [isCheckinRulesOpen, setIsCheckinRulesOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [canState, setCanState] = useState(() => readCanState());
  const [companionDays, setCompanionDays] = useState(1);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [avatarBump, setAvatarBump] = useState(false);
  const [floatHearts, setFloatHearts] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrency(readDefaultCurrency());
      const cans = readCanState();
      setCanState(cans);
      const days = readCompanionDays();
      setCompanionDays(days);
      setQuoteIdx(0);
      setLastSyncAt(readLastCloudSyncAt());
      setOnline(navigator.onLine);
    }, 0);
    const onCan = () => setCanState(readCanState());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener(CAN_STATE_EVENT, onCan);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CAN_STATE_EVENT, onCan);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function handleLanguageChange(next: Locale, label: string) {
    setLocale(next);
    setIsLanguageSheetOpen(false);
    toast.success(createT(next)("toast.languageSet", { label }));
  }

  /** 仅切换默认记账币种；不做任何历史汇率换算 */
  function handleCurrencyChange(next: CurrencyCode) {
    setCurrency(next);
    writeDefaultCurrency(next);
    setIsCurrencySheetOpen(false);
    toast.success(t("toast.currencySet", { code: next }));
  }

  function handleFontStyleChange(next: FontStyle) {
    setFontStyle(next);
  }

  function handleThemeClick() {
    setIsThemeStoreOpen(true);
  }

  function handleTipClick() {
    setIsTipRiverOpen(true);
  }

  function cycleQuote(e?: MouseEvent) {
    e?.stopPropagation();
    setQuoteIdx((i) => (i + 1) % RIVER_QUOTE_KEYS.length);
  }

  function pokeRiver() {
    setAvatarBump(true);
    window.setTimeout(() => setAvatarBump(false), 450);
    setFloatHearts((n) => n + 1);
    window.setTimeout(() => setFloatHearts((n) => Math.max(0, n - 1)), 900);
    const pokeKey =
      RIVER_POKE_KEYS[Math.floor(Math.random() * RIVER_POKE_KEYS.length)]!;
    toast(t(pokeKey), { duration: 2200 });
  }

  function handleFeedback() {
    const subject = encodeURIComponent(
      locale.startsWith("zh") ? "钱包小猫 · 使用反馈" : "Wallet Cat feedback",
    );
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}`;
  }

  function syncStatusValue() {
    if (!online) return t("settings.sync.offline");
    if (lastSyncAt) {
      return t("settings.sync.synced", {
        time: formatSyncClock(lastSyncAt, locale),
      });
    }
    return t("settings.sync.online");
  }

  function fontStyleLabel(style: FontStyle) {
    const option = FONT_STYLE_OPTIONS.find((item) => item.code === style);
    return option ? t(option.labelKey) : style;
  }

  function fontSizeLabel(size: FontSize) {
    const option = FONT_SIZE_OPTIONS.find((item) => item.code === size);
    return option ? t(option.labelKey) : size;
  }

  async function exportAll() {
    if (!navigator.onLine) {
      toast.error(t("toast.exportOffline"));
      return;
    }
    setExporting(true);
    const toastId = toast.loading(t("toast.exportLoading"));
    try {
      const rows = await queryTransactions();
      if (rows.length === 0) {
        toast.error(t("toast.exportEmpty"), { id: toastId });
        return;
      }
      exportTransactionsToXlsx(rows, { t });
      const synced = touchLastCloudSync();
      setLastSyncAt(synced);
      const milestone = completeMilestone("milestone_export");
      if (milestone.awarded) {
        toast.success(t("can.milestone.export"));
      }
      toast.success(t("toast.exportDone", { count: rows.length }), {
        id: toastId,
      });
    } catch (error) {
      toast.error(formatSupabaseError(error), { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  async function handleResetAllData() {
    if (!navigator.onLine) {
      toast.error(t("toast.resetOffline"));
      return;
    }
    setResetting(true);
    const toastId = toast.loading(t("toast.resetLoading"));
    try {
      const { error: txError } = await getSupabase()
        .from("transactions")
        .delete()
        .gte("date", "1970-01-01");
      if (txError) throw txError;

      const { error: chatError } = await getSupabase()
        .from("chat_messages")
        .delete()
        .gte("created_at", "1970-01-01");
      if (chatError) throw chatError;

      const { clearPlannerCloud } = await import("@/lib/planner-cloud");
      await clearPlannerCloud();

      for (const key of PLANNER_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      clearGameArcadeLocal();
      writeDefaultCurrency(currency);
      writeStoredLocale(locale);

      setIsResetModalOpen(false);
      toast.success(t("toast.resetDone"), { id: toastId });
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("toast.resetFail"),
        { id: toastId },
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto overscroll-contain px-4 pb-28 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
      <PageHeader
        caption={t("settings.eyebrow")}
        className="px-1"
        title={t("settings.title")}
      />

      {/* River 互动名片 — 低饱和焦糖奶油 */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-gradient-to-br from-[#FDFBF7] via-[#FAFAF5] to-[#F5F0E8] p-4 shadow-xs shadow-stone-900/5">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            aria-label={t("settings.river.tapHint")}
            className="relative size-14 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
            onClick={pokeRiver}
            type="button"
          >
            <span
              className={`block size-14 transition-transform duration-200 hover:scale-[1.08] active:scale-[0.92] ${
                avatarBump ? "river-avatar-wobble" : ""
              }`}
            >
              <CatAvatar className="size-14" size={56} />
            </span>
            {floatHearts > 0
              ? Array.from({ length: Math.min(floatHearts, 3) }).map((_, i) => (
                  <Heart
                    aria-hidden
                    className="river-float-heart pointer-events-none absolute left-1/2 top-0 size-3.5 -translate-x-1/2 fill-[var(--color-primary)]/40 text-[var(--color-primary)]"
                    key={`heart-${floatHearts}-${i}`}
                    style={{
                      marginLeft: `${(i - 1) * 10}px`,
                      animationDelay: `${i * 60}ms`,
                    }}
                    strokeWidth={2}
                  />
                ))
              : null}
          </button>
          <span className="pointer-events-none inline-flex items-center gap-0.5 text-[11px] font-medium tracking-wider text-stone-400">
            <Sparkles className="size-2.5 shrink-0" strokeWidth={2.5} />
            {t("settings.river.tapHint")}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[15px] font-medium leading-relaxed text-stone-800">
              {t(RIVER_QUOTE_KEYS[quoteIdx]!)}
            </p>
            <button
              aria-label={t("settings.river.refreshAria")}
              className="grid size-6 shrink-0 place-items-center text-stone-300 transition-colors hover:text-stone-500 active:scale-95"
              onClick={cycleQuote}
              type="button"
            >
              <RefreshCw className="size-3.5" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-stone-400">
            <span>{t("settings.river.days", { days: companionDays })}</span>
            <button
              className="group inline-flex cursor-pointer items-center gap-1 font-medium text-stone-600 transition-colors hover:text-stone-900"
              onClick={() => setIsCanDrawerOpen(true)}
              type="button"
            >
              <CatCanIcon className="size-3.5 text-stone-500 transition-transform group-hover:scale-110" />
              <span>
                {canState.cans_count > 0
                  ? t("settings.river.moodFull")
                  : t("settings.river.moodEmpty")}
              </span>
              <ChevronRight className="size-3.5 text-stone-400 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 外观与偏好 */}
      <section className="mt-6">
        <p className={SECTION_LABEL}>{t("settings.section.preferences")}</p>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xs divide-y divide-[var(--color-bg-soft)]">
          <SettingsRow
            icon={<Globe className="size-4" strokeWidth={2} />}
            iconClassName={ICON_BG.look}
            label={t("settings.language")}
            onClick={() => setIsLanguageSheetOpen(true)}
            value={localeDisplayName(locale)}
          />
          <SettingsRow
            icon={<Coins className="size-4" strokeWidth={2} />}
            iconClassName={ICON_BG.look}
            label={t("settings.defaultCurrency")}
            onClick={() => setIsCurrencySheetOpen(true)}
            value={currency}
          />
          <SettingsRow
            chevron
            icon={<Type className="size-4" strokeWidth={2} />}
            iconClassName={ICON_BG.look}
            label={t("settings.fontStyle")}
            onClick={() => setIsFontStyleSheetOpen(true)}
            value={`${fontStyleLabel(fontStyle)}${locale.startsWith("zh") ? `（${fontSizeLabel(fontSize)}）` : ` (${fontSizeLabel(fontSize)})`}`}
          />
          <SettingsRow
            chevron
            icon={<Palette className="size-4" strokeWidth={2} />}
            iconClassName={ICON_BG.look}
            label={t("settings.theme")}
            onClick={handleThemeClick}
            value={themeDisplayName(canState.current_theme)}
          />
        </div>
      </section>

      {/* 喵喵工坊 */}
      <section className="mt-5">
        <p className={SECTION_LABEL}>{t("settings.section.workshop")}</p>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xs divide-y divide-[var(--color-bg-soft)]">
          <SettingsRow
            chevron
            icon={
              <Flame
                className="size-4 text-[var(--color-primary)]"
                strokeWidth={2}
              />
            }
            iconClassName={ICON_BG.workshop}
            label={t("settings.checkin")}
            onClick={() => setIsCheckinRulesOpen(true)}
            value={
              <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)]">
                <span>
                  {t("can.checkin.streak", {
                    days: canState.checkin_streak,
                  })}
                </span>
                <span className="opacity-80">
                  {locale.startsWith("zh") ? "（" : " ("}
                  {t("can.checkin.fragmentsShort", {
                    n: canState.can_fragments,
                  })}
                  {locale.startsWith("zh") ? "）" : ")"}
                </span>
              </span>
            }
          />
          <SettingsRow
            chevron
            icon={
              <CatCanIcon className="size-4 text-amber-700" />
            }
            iconClassName={ICON_BG.workshop}
            label={t("can.drawer.title")}
            onClick={() => setIsCanDrawerOpen(true)}
            value={
              <span className="text-xs font-medium text-amber-700/80">
                {t("can.drawer.badge")}
              </span>
            }
          />
          <SettingsRow
            chevron
            icon={
              <Gamepad2 className="size-5 text-amber-600" strokeWidth={2} />
            }
            iconClassName={ICON_BG.workshop}
            label={t("game.arcade.title")}
            onClick={() => setIsArcadeOpen(true)}
            value={
              <span className="text-xs font-medium text-amber-700/80">
                {t("game.arcade.badge")}
              </span>
            }
          />
          <SettingsRow
            chevron
            icon={<Heart className="size-4 text-[var(--color-primary)]" strokeWidth={2} />}
            iconClassName={ICON_BG.workshop}
            label={t("settings.tipCat")}
            onClick={handleTipClick}
          />
        </div>
      </section>

      {/* 数据与安全 */}
      <section className="mt-5">
        <p className={SECTION_LABEL}>{t("settings.section.data")}</p>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xs divide-y divide-[var(--color-bg-soft)]">
          <SettingsRow
            chevron={false}
            icon={<Cloud className="size-4" strokeWidth={2} />}
            iconClassName={ICON_BG.data}
            label={t("settings.sync")}
            value={syncStatusValue()}
          />
          <button
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-all duration-150 active:scale-[0.98] active:bg-[var(--color-bg-soft)]/80 disabled:opacity-50"
            disabled={exporting}
            onClick={() => void exportAll()}
            type="button"
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl text-[var(--color-text-main)] opacity-90 ${ICON_BG.data}`}
            >
              {exporting ? (
                <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />
              ) : (
                <Download className="size-4" strokeWidth={2} />
              )}
            </span>
            <span className="min-w-0 flex-1 text-body font-semibold text-[var(--color-text-main)]">
              {t("settings.exportData")}
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-[var(--color-text-main)] opacity-30"
              strokeWidth={2}
            />
          </button>
          <SettingsRow
            danger
            icon={<Trash2 className="size-4" strokeWidth={2} />}
            iconClassName="bg-[#F8EDEA]"
            label={t("settings.resetAll")}
            onClick={() => setIsResetModalOpen(true)}
          />
        </div>
      </section>

      {/* 关于应用 */}
      <section className="mt-5">
        <p className={SECTION_LABEL}>{t("settings.section.about")}</p>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xs divide-y divide-[var(--color-bg-soft)]">
          <SettingsRow
            chevron={false}
            icon={<Info className="size-4" strokeWidth={2} />}
            iconClassName={ICON_BG.about}
            label={t("settings.version")}
            value="v3.0"
          />
          <SettingsRow
            chevron
            icon={<Mail className="size-4" strokeWidth={2} />}
            iconClassName={ICON_BG.about}
            label={t("settings.feedback")}
            onClick={handleFeedback}
            value={t("settings.feedbackValue")}
          />
        </div>
      </section>

      <BottomSheet
        onOpenChange={setIsLanguageSheetOpen}
        open={isLanguageSheetOpen}
        title={t("settings.languageSheetTitle")}
      >
        <div className="space-y-2 pt-1">
          {LOCALE_OPTIONS.map((option) => {
            const active = locale === option.code;
            return (
              <button
                className={`flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                  active
                    ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                    : "bg-[var(--color-bg-soft)] text-[var(--color-text-main)]"
                }`}
                key={option.code}
                onClick={() => handleLanguageChange(option.code, option.label)}
                type="button"
              >
                <span>{option.label}</span>
                {active ? (
                  <span className="text-xs opacity-70">{t("settings.current")}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        onOpenChange={setIsFontStyleSheetOpen}
        open={isFontStyleSheetOpen}
        title={t("settings.fontStyle")}
      >
        <div className="space-y-5 pt-1 pb-2">
          <div className="space-y-2">
            {FONT_STYLE_OPTIONS.map((option) => {
              const active = fontStyle === option.code;
              return (
                <button
                  className={`flex h-14 w-full items-center justify-between rounded-2xl px-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                      : "bg-[var(--color-bg-soft)] text-[var(--color-text-main)]"
                  }`}
                  key={option.code}
                  onClick={() => handleFontStyleChange(option.code)}
                  style={{ fontFamily: FONT_FAMILY_STACK[option.code] }}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-semibold">
                      {t(option.labelKey)}
                    </span>
                    {option.hintKey ? (
                      <span className="mt-0.5 block text-xs text-[var(--color-text-main)] opacity-60">
                        {t(option.hintKey)}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <span className="text-xs font-semibold opacity-70">
                      {t("settings.current")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div>
            <p className="mb-2 px-0.5 text-xs font-semibold text-[var(--color-text-main)] opacity-60">
              {t("settings.fontSize")}
            </p>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="select-none text-[11px] font-semibold text-[var(--color-text-main)] opacity-60"
              >
                A
              </span>
              <div
                aria-label={t("settings.fontSize")}
                className="grid flex-1 grid-cols-3 rounded-2xl bg-[var(--color-bg-soft)] p-1"
                role="radiogroup"
              >
                {FONT_SIZE_OPTIONS.map((option) => {
                  const active = fontSize === option.code;
                  return (
                    <button
                      aria-checked={active}
                      className={`h-9 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? "bg-[var(--color-bg-card)] text-[var(--color-text-main)] shadow-sm"
                          : "text-[var(--color-text-main)] opacity-60"
                      }`}
                      key={option.code}
                      onClick={() => setFontSize(option.code)}
                      role="radio"
                      type="button"
                    >
                      {t(option.labelKey)}
                    </button>
                  );
                })}
              </div>
              <span
                aria-hidden
                className="select-none text-lg font-semibold leading-none text-[var(--color-text-main)] opacity-60"
              >
                A
              </span>
            </div>
          </div>

          <p
            className="rounded-2xl bg-[var(--color-bg-soft)] px-3.5 py-3 text-sm leading-6 text-[var(--color-text-main)]"
            style={{ fontFamily: FONT_FAMILY_STACK[fontStyle] }}
          >
            {t("settings.fontPreview")}
            <span className="mt-1 block font-numeric text-base font-semibold text-expense">
              $1,280.50
            </span>
          </p>
        </div>
      </BottomSheet>

      <BottomSheet
        onOpenChange={setIsCurrencySheetOpen}
        open={isCurrencySheetOpen}
        title={t("settings.currencySheetTitle")}
      >
        <div className="space-y-2 pt-1">
          {CURRENCY_CODES.map((code) => {
            const active = currency === code;
            return (
              <button
                className={`flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                  active
                    ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                    : "bg-[var(--color-bg-soft)] text-[var(--color-text-main)]"
                }`}
                key={code}
                onClick={() => handleCurrencyChange(code)}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <CurrencyIcon
                    className={`size-4 ${active ? "text-[var(--color-primary)]" : "text-[var(--color-text-main)] opacity-50"}`}
                    code={code}
                    strokeWidth={2}
                  />
                  {code} ({translateCurrencyLabel(code, t)})
                </span>
                {active ? (
                  <span className="text-xs opacity-70">{t("settings.current")}</span>
                ) : null}
              </button>
            );
          })}
          <p className="px-1 pt-2 text-caption leading-5 text-[var(--color-text-main)] opacity-60">
            {t("settings.currencyHint")}
          </p>
        </div>
      </BottomSheet>

      <ThemeStoreSheet
        onOpenChange={setIsThemeStoreOpen}
        open={isThemeStoreOpen}
      />
      <CanBalanceSheet
        onGoArcade={() => setIsArcadeOpen(true)}
        onGoCheckin={() => setIsCheckinRulesOpen(true)}
        onGoTip={handleTipClick}
        onOpenChange={setIsCanDrawerOpen}
        open={isCanDrawerOpen}
      />
      <GameArcadeDrawer
        onOpenChange={setIsArcadeOpen}
        open={isArcadeOpen}
      />
      <TipRiverSheet
        onOpenChange={setIsTipRiverOpen}
        open={isTipRiverOpen}
      />
      <CheckinRulesModal
        onOpenChange={setIsCheckinRulesOpen}
        open={isCheckinRulesOpen}
        state={canState}
      />

      <ConfirmDialog
        busy={resetting}
        confirmDanger
        confirmLabel={t("settings.resetConfirm")}
        description={t("settings.resetDescription")}
        onCancel={() => !resetting && setIsResetModalOpen(false)}
        onConfirm={() => void handleResetAllData()}
        open={isResetModalOpen}
        title={t("settings.resetTitle")}
      />
    </main>
  );
}
