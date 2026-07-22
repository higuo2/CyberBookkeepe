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
import {
  CURRENCY_CODES,
  CURRENCY_META,
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

const LANGUAGE_KEY = "cyberbookkeeper_language";
const FONT_KEY = "cyberbookkeeper_font";

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

export function ProfilePage() {
  const [language, setLanguage] = useState("简体中文");
  const [currency, setCurrency] = useState<CurrencyCode>("HKD");
  const [fontSetting, setFontSetting] = useState("系统默认");
  const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrency(readDefaultCurrency());
      const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) setLanguage(savedLanguage);
      const savedFont = localStorage.getItem(FONT_KEY);
      if (savedFont) setFontSetting(savedFont);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleLanguageClick() {
    toast.message("目前仅支持简体中文，多语言即将开放");
  }

  /** 仅切换默认记账币种；不做任何历史汇率换算 */
  function handleCurrencyChange(next: CurrencyCode) {
    setCurrency(next);
    writeDefaultCurrency(next);
    setIsCurrencySheetOpen(false);
    toast.success(`默认记账币种已设为 ${next}`);
  }

  function handleFontClick() {
    toast.message("字体设置即将开放，当前跟随系统默认");
  }

  function handleTipClick() {
    toast.message("谢谢你～罐头正在筹备中 🐟");
  }

  async function exportAll() {
    if (!navigator.onLine) {
      toast.error("当前无网络，无法导出");
      return;
    }
    setExporting(true);
    const toastId = toast.loading("正在导出全部账单…");
    try {
      const rows = await queryTransactions();
      if (rows.length === 0) {
        toast.error("暂无账单可导出", { id: toastId });
        return;
      }
      exportTransactionsToXlsx(rows);
      toast.success(`已导出 ${rows.length} 笔账单`, { id: toastId });
    } catch (error) {
      toast.error(formatSupabaseError(error), { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  async function handleResetAllData() {
    if (!navigator.onLine) {
      toast.error("当前无网络，无法清空云端数据");
      return;
    }
    setResetting(true);
    const toastId = toast.loading("正在清空数据…");
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
      localStorage.setItem(LANGUAGE_KEY, language);
      localStorage.setItem(FONT_KEY, fontSetting);

      setIsResetModalOpen(false);
      toast.success("已清空所有数据，页面即将刷新", { id: toastId });
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "清空失败，请稍后重试",
        { id: toastId },
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto overscroll-contain bg-[#FFFDF0] px-4 pb-8 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
      <header className="px-1">
        <p className="text-sm font-semibold text-[#F8A055]">Settings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#5C4A32]">
          设置
        </h1>
        <p className="mt-2 text-sm text-[#9A7B55]">偏好、数据与关于小猫。</p>
      </header>

      {/* 卡片 A：偏好设置 */}
      <section className="mt-6">
        <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-[#A08875]">
          偏好设置
        </p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm divide-y divide-[#F5F0E8]">
          <SettingsRow
            icon={<Globe className="size-4" strokeWidth={2} />}
            label="界面语言"
            onClick={handleLanguageClick}
            value={language}
          />
          <SettingsRow
            icon={<Coins className="size-4" strokeWidth={2} />}
            label="默认记账币种"
            onClick={() => setIsCurrencySheetOpen(true)}
            value={currency}
          />
          <SettingsRow
            icon={<Type className="size-4" strokeWidth={2} />}
            label="字体设置"
            onClick={handleFontClick}
            value={fontSetting}
          />
        </div>
      </section>

      {/* 卡片 B：数据管理 */}
      <section className="mt-5">
        <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-[#A08875]">
          数据管理
        </p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm divide-y divide-[#F5F0E8]">
          <button
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors active:bg-[#FAF6EC]/80 disabled:opacity-50"
            disabled={exporting}
            onClick={() => void exportAll()}
            type="button"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FFF6D9] text-[#C4956A]">
              {exporting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" strokeWidth={2} />
              )}
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-[#5C4A32]">
              导出账单数据
            </span>
            <ChevronRight className="size-4 shrink-0 text-[#D4C4B0]" />
          </button>
          <SettingsRow
            danger
            icon={<Trash2 className="size-4" strokeWidth={2} />}
            label="重置所有数据"
            onClick={() => setIsResetModalOpen(true)}
          />
        </div>
      </section>

      {/* 卡片 C：关于 */}
      <section className="mt-5">
        <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-[#A08875]">
          关于
        </p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm divide-y divide-[#F5F0E8]">
          <SettingsRow
            icon={<Heart className="size-4" strokeWidth={2} />}
            label="赏个猫罐头 🐟"
            onClick={handleTipClick}
          />
          <SettingsRow
            chevron={false}
            icon={<Info className="size-4" strokeWidth={2} />}
            label="当前版本"
            value="v2.0"
          />
        </div>
      </section>

      <BottomSheet
        onOpenChange={setIsCurrencySheetOpen}
        open={isCurrencySheetOpen}
        title="选择默认记账币种"
      >
        <div className="space-y-2 pt-1">
          {CURRENCY_CODES.map((code) => {
            const active = currency === code;
            const meta = CURRENCY_META[code];
            return (
              <button
                className={`flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold transition-all active:scale-[0.99] ${
                  active
                    ? "bg-[#F8A055]/15 text-[#8C6D53] ring-2 ring-[#F8A055]"
                    : "bg-[#FAF6EC] text-[#5C4A32]"
                }`}
                key={code}
                onClick={() => handleCurrencyChange(code)}
                type="button"
              >
                <span>
                  {meta.flag} {code} ({meta.label})
                </span>
                {active ? <span className="text-xs">当前</span> : null}
              </button>
            );
          })}
          <p className="px-1 pt-2 text-xs leading-5 text-[#A08875]">
            原生多币种独立结算：切换默认币种只影响新记账与 AI
            识别兜底，不会换算历史账单。
          </p>
        </div>
      </BottomSheet>

      <ConfirmDialog
        busy={resetting}
        confirmDanger
        confirmLabel="确认清空"
        description="此操作不可逆，所有账单、规划和对话记录将被永久删除！小猫会很伤心的😿"
        onCancel={() => !resetting && setIsResetModalOpen(false)}
        onConfirm={() => void handleResetAllData()}
        open={isResetModalOpen}
        title="确定要清空所有数据吗？"
      />
    </main>
  );
}
