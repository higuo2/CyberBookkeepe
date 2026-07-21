"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import {
  formatHKD,
  getMonthRange,
  sumByCategory,
} from "@/lib/transaction-utils";
import type { SummaryApiResponse, Transaction } from "@/lib/types";

export function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState("");
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [categories, setCategories] = useState<{ name: string; value: number }[]>(
    [],
  );

  const loadMonth = useCallback(async () => {
    await Promise.resolve();
    if (!navigator.onLine) {
      toast.error("当前无网络，无法读取本月数据");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { firstDay, lastDay } = getMonthRange();
      const { data, error } = await getSupabase()
        .from("transactions")
        .select("id, amount, type, category, date, note")
        .gte("date", firstDay)
        .lte("date", lastDay);
      if (error) throw error;

      const rows = (data ?? []) as Transaction[];
      const expenses = rows.filter((item) => item.type === "EXPENSE");
      const incomes = rows.filter((item) => item.type === "INCOME");
      setTotalExpense(
        expenses.reduce((sum, item) => sum + Number(item.amount), 0),
      );
      setTotalIncome(
        incomes.reduce((sum, item) => sum + Number(item.amount), 0),
      );
      setCategories(sumByCategory(expenses));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "读取失败，请稍后重试",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMonth(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMonth]);

  async function generateSummary() {
    if (!navigator.onLine) {
      toast.error("当前无网络，无法生成总结");
      return;
    }
    setGenerating(true);
    const toastId = toast.loading("AI 正在撰写本月财务总结…");
    try {
      const monthLabel = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`;
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthLabel,
          totalExpense,
          totalIncome,
          categories,
        }),
      });
      const payload = (await response.json()) as SummaryApiResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok ? "生成失败" : payload.message || "生成失败",
        );
      }
      setSummary(payload.summary);
      toast.success("总结已生成", { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "生成失败，请稍后重试",
        { id: toastId },
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto overscroll-contain bg-[#FAF6EC] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
      <header>
        <p className="text-sm font-semibold text-[#F8A055]">AI 洞察</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#5C4A32]">
          总结
        </h1>
        <p className="mt-2 text-sm text-[#9A7B55]">
          一键生成本月港币账单的情绪化理财建议。
        </p>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#A08B68]">本月支出</p>
          <p className="mt-2 text-xl font-semibold text-[#E07A3D]">
            {loading ? "…" : formatHKD(totalExpense)}
          </p>
        </div>
        <div className="rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#A08B68]">本月收入</p>
          <p className="mt-2 text-xl font-semibold text-[#2A9D8F]">
            {loading ? "…" : formatHKD(totalIncome)}
          </p>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mt-4 rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#A08B68]">支出结构 Top</p>
          <ul className="mt-3 space-y-2">
            {categories.slice(0, 5).map((item) => (
              <li
                className="flex items-center justify-between text-sm"
                key={item.name}
              >
                <span className="text-[#8A7A5C]">{item.name}</span>
                <span className="font-medium text-[#5C4A32]">
                  {formatHKD(item.value)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A055] font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
        disabled={loading || generating}
        onClick={generateSummary}
        type="button"
      >
        {generating ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : (
          <Sparkles className="size-5" />
        )}
        {generating ? "生成中…" : "一键生成 AI 财务总结"}
      </button>

      {summary && (
        <article className="mt-5 rounded-3xl border border-[#EFE5D3] bg-white p-5 text-sm leading-7 text-[#5C4A32] shadow-sm">
          {summary}
        </article>
      )}
    </main>
  );
}
