"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  LoaderCircle,
  Save,
  Settings2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { exportTransactionsToXlsx } from "@/lib/export";
import { getSupabase } from "@/lib/supabase";
import {
  formatHKD,
  readBudgetFromStorage,
  writeBudgetToStorage,
} from "@/lib/transaction-utils";
import type { Transaction } from "@/lib/types";
import { filterActiveTransactions } from "@/lib/utils";

export function ProfilePage() {
  const [budgetInput, setBudgetInput] = useState("");
  const [savedBudget, setSavedBudget] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = readBudgetFromStorage();
      setSavedBudget(value);
      setBudgetInput(value > 0 ? String(value) : "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const saveBudget = useCallback(() => {
    const amount = Number(budgetInput);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("请输入有效的预算金额");
      return;
    }
    writeBudgetToStorage(amount);
    setSavedBudget(amount);
    toast.success("本月预算已保存");
  }, [budgetInput]);

  async function exportAll() {
    if (!navigator.onLine) {
      toast.error("当前无网络，无法导出");
      return;
    }
    setExporting(true);
    const toastId = toast.loading("正在导出全部账单…");
    try {
      const { data, error } = await getSupabase()
        .from("transactions")
        .select("id, amount, type, category, date, note")
        .order("date", { ascending: false });
      if (error) throw error;
      const rows = filterActiveTransactions((data ?? []) as Transaction[]);
      if (rows.length === 0) {
        toast.error("暂无账单可导出", { id: toastId });
        return;
      }
      exportTransactionsToXlsx(rows);
      toast.success(`已导出 ${rows.length} 笔账单`, { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "导出失败，请稍后重试",
        { id: toastId },
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto overscroll-contain bg-[#FAF6EC] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
      <header>
        <p className="text-sm font-semibold text-[#F8A055]">个人中心</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#5C4A32]">
          我的
        </h1>
        <p className="mt-2 text-sm text-[#9A7B55]">
          预算、导出与系统设置。币种默认 HKD。
        </p>
      </header>

      <section className="mt-6 rounded-3xl border border-[#EFE5D3] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[#F8A055]">
          <Wallet className="size-5" />
          <h2 className="font-semibold text-[#5C4A32]">本月总预算</h2>
        </div>
        <p className="mt-2 text-sm text-[#9A7B55]">
          当前已保存：{savedBudget > 0 ? formatHKD(savedBudget) : "未设置"}
        </p>
        <label className="mt-4 block text-xs font-medium text-[#9A7B55]">
          预算金额（HK$）
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] px-3 text-sm text-[#5C4A32] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15"
            inputMode="decimal"
            min="0"
            onChange={(event) => setBudgetInput(event.target.value)}
            placeholder="例如 15000"
            step="0.01"
            type="number"
            value={budgetInput}
          />
        </label>
        <button
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A055] text-sm font-semibold text-white shadow-sm transition-all active:scale-95"
          onClick={saveBudget}
          type="button"
        >
          <Save className="size-4" />
          保存预算
        </button>
      </section>

      <section className="mt-4 rounded-3xl border border-[#EFE5D3] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[#F8A055]">
          <Download className="size-5" />
          <h2 className="font-semibold text-[#5C4A32]">数据导出</h2>
        </div>
        <p className="mt-2 text-sm text-[#9A7B55]">
          导出全部账单为 Excel（.xlsx），含日期、类型、分类、金额、备注。
        </p>
        <button
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#A3E4D7] text-sm font-semibold text-[#1F4A44] shadow-sm transition-all active:scale-95 disabled:opacity-50"
          disabled={exporting}
          onClick={() => void exportAll()}
          type="button"
        >
          {exporting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          导出报表
        </button>
      </section>

      <section className="mt-4 rounded-3xl border border-[#EFE5D3] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[#F8A055]">
          <Settings2 className="size-5" />
          <h2 className="font-semibold text-[#5C4A32]">系统设置</h2>
        </div>
        <ul className="mt-4 space-y-3 text-sm text-[#8A7A5C]">
          <li className="flex items-center justify-between rounded-2xl bg-[#FFF6D9] px-3 py-3">
            <span>默认币种</span>
            <span className="font-medium text-[#5C4A32]">HKD</span>
          </li>
          <li className="flex items-center justify-between rounded-2xl bg-[#FFF6D9] px-3 py-3">
            <span>版本</span>
            <span className="font-medium text-[#5C4A32]">v2.0</span>
          </li>
          <li className="rounded-2xl bg-[#FFF6D9] px-3 py-3 text-[#A08B68]">
            更多设置即将开放（主题、提醒、多账本…）
          </li>
        </ul>
      </section>
    </main>
  );
}
