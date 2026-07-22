"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  Coins,
  Download,
  Globe,
  Heart,
  Info,
  LoaderCircle,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog, SettingsRow } from "@/components/ConfirmDialog";
import { CurrencyIcon } from "@/components/AppIcons";
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
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrency(readDefaultCurrency());
    }, 0);
    return () => window.clearTimeout(timer);
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
    setIsFontStyleSheetOpen(false);
  }

  function handleTipClick() {
    toast.message(t("toast.tipThanks"));
  }

  function fontStyleLabel(style: FontStyle) {
    const option = FONT_STYLE_OPTIONS.find((item) => item.code === style);
    return option ? t(option.labelKey) : style;
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

      for (const key of PLANNER_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
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
    <main className="h-full overflow-y-auto overscroll-contain bg-[#FFFDF0] px-4 pb-8 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
      <PageHeader
        caption={t("settings.eyebrow")}
        className="px-1"
        description={t("settings.subtitle")}
        title={t("settings.title")}
      />

      {/* 卡片 A：偏好设置 */}
      <section className="mt-6">
        <p className="mb-2 px-1 text-caption font-semibold tracking-wide">
          {t("settings.section.preferences")}
        </p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm divide-y divide-[#F5F0E8]">
          <SettingsRow
            icon={<Globe className="size-4" strokeWidth={2} />}
            label={t("settings.language")}
            onClick={() => setIsLanguageSheetOpen(true)}
            value={localeDisplayName(locale)}
          />
          <SettingsRow
            icon={<Coins className="size-4" strokeWidth={2} />}
            label={t("settings.defaultCurrency")}
            onClick={() => setIsCurrencySheetOpen(true)}
            value={currency}
          />
        </div>
      </section>

      {/* 卡片：字体与字号 */}
      <section className="mt-5">
        <p className="mb-2 px-1 text-caption font-semibold tracking-wide">
          {t("settings.fontSection")}
        </p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <SettingsRow
            chevron
            icon={<Type className="size-4" strokeWidth={2} />}
            label={t("settings.fontStyle")}
            onClick={() => setIsFontStyleSheetOpen(true)}
            value={fontStyleLabel(fontStyle)}
          />

          <div className="border-t border-[#F5F0E8] px-4 pb-4 pt-3">
            <p className="text-body">{t("settings.fontSize")}</p>
            <div className="mt-3 flex items-center gap-3">
              <span
                aria-hidden
                className="select-none text-[11px] font-semibold text-[#8C8273]"
              >
                A
              </span>
              <div
                aria-label={t("settings.fontSize")}
                className="grid flex-1 grid-cols-3 rounded-2xl bg-[#FAF6EC] p-1"
                role="radiogroup"
              >
                {FONT_SIZE_OPTIONS.map((option) => {
                  const active = fontSize === option.code;
                  return (
                    <button
                      aria-checked={active}
                      className={`h-9 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? "bg-white text-[#3A322B] shadow-sm"
                          : "text-[#8C8273]"
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
                className="select-none text-lg font-semibold leading-none text-[#8C8273]"
              >
                A
              </span>
            </div>

            <p
              className="mt-4 rounded-2xl bg-[#FFF6D9] px-3.5 py-3 text-sm leading-6 text-[#4A3E31]"
              style={{ fontFamily: FONT_FAMILY_STACK[fontStyle] }}
            >
              {t("settings.fontPreview")}
              <span className="mt-1 block font-numeric text-base font-semibold text-[#E07A3D]">
                HK$1,280.50
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* 卡片 B：数据管理 */}
      <section className="mt-5">
        <p className="mb-2 px-1 text-caption font-semibold tracking-wide">
          {t("settings.section.data")}
        </p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm divide-y divide-[#F5F0E8]">
          <button
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-all duration-150 active:scale-[0.98] active:bg-[#FAF6EC]/80 disabled:opacity-50"
            disabled={exporting}
            onClick={() => void exportAll()}
            type="button"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FFF6D9] text-[#C4956A]">
              {exporting ? (
                <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />
              ) : (
                <Download className="size-4" strokeWidth={2} />
              )}
            </span>
            <span className="min-w-0 flex-1 text-body font-semibold">
              {t("settings.exportData")}
            </span>
            <ChevronRight className="size-4 shrink-0 text-[#D4C4B0]" strokeWidth={2} />
          </button>
          <SettingsRow
            danger
            icon={<Trash2 className="size-4" strokeWidth={2} />}
            label={t("settings.resetAll")}
            onClick={() => setIsResetModalOpen(true)}
          />
        </div>
      </section>

      {/* 卡片 C：关于 */}
      <section className="mt-5">
        <p className="mb-2 px-1 text-caption font-semibold tracking-wide">
          {t("settings.section.about")}
        </p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm divide-y divide-[#F5F0E8]">
          <SettingsRow
            icon={<Heart className="size-4" strokeWidth={2} />}
            label={t("settings.tipCat")}
            onClick={handleTipClick}
          />
          <SettingsRow
            chevron={false}
            icon={<Info className="size-4" strokeWidth={2} />}
            label={t("settings.version")}
            value="v2.0"
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
                    ? "bg-[#EE7828]/15 text-[#8C6D53] ring-2 ring-[#EE7828]"
                    : "bg-[#FAF6EC] text-[#4A3E31]"
                }`}
                key={option.code}
                onClick={() => handleLanguageChange(option.code, option.label)}
                type="button"
              >
                <span>{option.label}</span>
                {active ? (
                  <span className="text-xs">{t("settings.current")}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        onOpenChange={setIsFontStyleSheetOpen}
        open={isFontStyleSheetOpen}
        title={t("settings.fontStyleSheetTitle")}
      >
        <div className="space-y-2 pt-1">
          {FONT_STYLE_OPTIONS.map((option) => {
            const active = fontStyle === option.code;
            return (
              <button
                className={`flex h-14 w-full items-center justify-between rounded-2xl px-4 text-left transition-all duration-150 active:scale-[0.98] ${
                  active
                    ? "bg-[#EE7828]/15 text-[#8C6D53] ring-2 ring-[#EE7828]"
                    : "bg-[#FAF6EC] text-[#4A3E31]"
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
                    <span className="mt-0.5 block text-xs text-[#8C8273]">
                      {t(option.hintKey)}
                    </span>
                  ) : null}
                </span>
                {active ? (
                  <span className="text-xs font-semibold">
                    {t("settings.current")}
                  </span>
                ) : null}
              </button>
            );
          })}
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
                    ? "bg-[#EE7828]/15 text-[#8C6D53] ring-2 ring-[#EE7828]"
                    : "bg-[#FAF6EC] text-[#4A3E31]"
                }`}
                key={code}
                onClick={() => handleCurrencyChange(code)}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <CurrencyIcon
                    className={`size-4 ${active ? "text-[#8C6D53]" : "text-[#A08875]"}`}
                    code={code}
                    strokeWidth={2}
                  />
                  {code} ({translateCurrencyLabel(code, t)})
                </span>
                {active ? (
                  <span className="text-xs">{t("settings.current")}</span>
                ) : null}
              </button>
            );
          })}
          <p className="px-1 pt-2 text-caption leading-5">
            {t("settings.currencyHint")}
          </p>
        </div>
      </BottomSheet>

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
