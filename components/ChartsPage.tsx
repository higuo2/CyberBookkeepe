"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import {
  getMonthRange,
  lastNDays,
  sumByCategory,
} from "@/lib/transaction-utils";
import type { Transaction } from "@/lib/types";

const CategoryPieChart = dynamic(
  () =>
    import("@/components/ChartsVisuals").then((mod) => mod.CategoryPieChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-40 place-items-center">
        <LoaderCircle className="size-6 animate-spin text-[#F8A055]" />
      </div>
    ),
  },
);

const TrendBarChart = dynamic(
  () => import("@/components/ChartsVisuals").then((mod) => mod.TrendBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-64 place-items-center">
        <LoaderCircle className="size-6 animate-spin text-[#F8A055]" />
      </div>
    ),
  },
);

export function ChartsPage() {
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [weekTransactions, setWeekTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChart = useCallback(async (showToast = false) => {
    await Promise.resolve();
    if (!navigator.onLine) {
      toast.error("当前无网络，无法读取统计");
      setLoading(false);
      return;
    }

    const { firstDay, lastDay } = getMonthRange();
    const weekDays = lastNDays(7);
    const weekStart = weekDays[0];

    if (showToast) toast.loading("正在刷新统计…", { id: "refresh-chart" });
    setLoading(true);

    try {
      const monthQuery = getSupabase()
        .from("transactions")
        .select("id, amount, type, category, date, note")
        .eq("type", "EXPENSE")
        .gte("date", firstDay)
        .lte("date", lastDay)
        .order("date", { ascending: false });

      const weekQuery = getSupabase()
        .from("transactions")
        .select("id, amount, type, category, date, note")
        .eq("type", "EXPENSE")
        .gte("date", weekStart)
        .order("date", { ascending: true });

      const [monthRes, weekRes] = await Promise.all([monthQuery, weekQuery]);
      if (monthRes.error) throw monthRes.error;
      if (weekRes.error) throw weekRes.error;

      setMonthTransactions((monthRes.data ?? []) as Transaction[]);
      setWeekTransactions((weekRes.data ?? []) as Transaction[]);
      if (showToast) toast.success("统计已更新", { id: "refresh-chart" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "读取失败，请稍后重试",
        showToast ? { id: "refresh-chart" } : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadChart(), 0);
    return () => window.clearTimeout(timer);
  }, [loadChart]);

  const pieData = useMemo(
    () => sumByCategory(monthTransactions).slice(0, 4),
    [monthTransactions],
  );

  const trendData = useMemo(() => {
    const days = lastNDays(7);
    return days.map((date) => {
      const amount = weekTransactions
        .filter((item) => item.date === date)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return {
        date,
        amount,
        label: date.slice(5),
      };
    });
  }, [weekTransactions]);

  return (
    <main className="h-full overflow-y-auto overscroll-contain bg-[#FAF6EC] px-4 pb-5 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-[#F8A055]">消费分析</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#5C4A32]">
            统计
          </h1>
          <p className="mt-1 text-sm text-[#A08B68]">近 7 日趋势与分类占比</p>
        </div>
        <button
          aria-label="刷新统计"
          className="grid size-9 place-items-center rounded-full border border-[#EFE5D3] bg-white text-[#8A7A5C] shadow-sm transition-all active:scale-95 disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadChart(true)}
          type="button"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="mt-4 flex flex-col gap-3">
        <section className="rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[#5C4A32]">近 7 日支出趋势</h2>
          <div className="mt-1">
            {loading && weekTransactions.length === 0 ? (
              <div className="grid h-56 place-items-center">
                <LoaderCircle className="size-6 animate-spin text-[#F8A055]" />
              </div>
            ) : (
              <TrendBarChart data={trendData} />
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[#5C4A32]">
            支出分类占比 Top 4
          </h2>
          {loading && monthTransactions.length === 0 ? (
            <div className="grid h-40 place-items-center">
              <LoaderCircle className="size-6 animate-spin text-[#F8A055]" />
            </div>
          ) : (
            <div className="mt-1">
              <CategoryPieChart data={pieData} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
