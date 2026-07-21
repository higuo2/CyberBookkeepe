"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { computeBudgetStats } from "@/lib/budget";
import { getSupabase } from "@/lib/supabase";
import {
  formatHKD,
  getMonthRange,
  lastNDays,
  readBudgetFromStorage,
  sumByCategory,
} from "@/lib/transaction-utils";
import type { Transaction, TransactionType } from "@/lib/types";

const CategoryPieChart = dynamic(
  () =>
    import("@/components/ChartsVisuals").then((mod) => mod.CategoryPieChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-56 place-items-center">
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

const BudgetProgressCard = dynamic(
  () =>
    import("@/components/ChartsVisuals").then((mod) => mod.BudgetProgressCard),
  { ssr: false },
);

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function budgetAnchorDate(monthCursor: Date) {
  const now = new Date();
  if (
    monthCursor.getFullYear() === now.getFullYear() &&
    monthCursor.getMonth() === now.getMonth()
  ) {
    return now;
  }
  return new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
}

export function ChartsPage() {
  const [mode, setMode] = useState<TransactionType>("EXPENSE");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [weekTransactions, setWeekTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadChart = useCallback(
    async (showToast = false) => {
      await Promise.resolve();
      if (!navigator.onLine) {
        toast.error("当前无网络，无法读取统计");
        setLoading(false);
        return;
      }

      const { firstDay, lastDay } = getMonthRange(monthCursor);
      const weekDays = lastNDays(7);
      const weekStart = weekDays[0];

      if (showToast) toast.loading("正在刷新统计…", { id: "refresh-chart" });
      setLoading(true);
      setBudget(readBudgetFromStorage());

      try {
        const monthQuery = getSupabase()
          .from("transactions")
          .select("id, amount, type, category, date, note")
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

        setTransactions((monthRes.data ?? []) as Transaction[]);
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
    },
    [monthCursor],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadChart(), 0);
    return () => window.clearTimeout(timer);
  }, [loadChart]);

  const filtered = useMemo(
    () => transactions.filter((item) => item.type === mode),
    [transactions, mode],
  );
  const total = filtered.reduce((sum, item) => sum + Number(item.amount), 0);
  const pieData = useMemo(() => sumByCategory(filtered), [filtered]);

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

  const monthExpense = transactions
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const budgetStats = computeBudgetStats(
    budget,
    monthExpense,
    budgetAnchorDate(monthCursor),
  );

  function shiftMonth(delta: number) {
    setMonthCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  return (
    <main className="h-full overflow-y-auto overscroll-contain bg-[#FAF6EC] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-[#F8A055]">消费分析</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#5C4A32]">
            统计
          </h1>
        </div>
        <button
          aria-label="刷新统计"
          className="grid size-11 place-items-center rounded-full border border-[#EFE5D3] bg-white text-[#8A7A5C] shadow-sm transition-all active:scale-95 disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadChart(true)}
          type="button"
        >
          <RefreshCw className={`size-4.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF6D9] p-1.5">
        {([
          { key: "EXPENSE", label: "支出统计", icon: TrendingDown },
          { key: "INCOME", label: "收入统计", icon: TrendingUp },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              mode === key
                ? "bg-white text-[#5C4A32] shadow-sm"
                : "text-[#A08B68]"
            }`}
            key={key}
            onClick={() => setMode(key)}
            type="button"
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#EFE5D3] bg-white px-2 py-1.5 shadow-sm">
        <button
          aria-label="上一月"
          className="grid size-9 place-items-center rounded-xl text-[#8C6D53] transition-all active:scale-95 hover:bg-[#FFF6D9]"
          onClick={() => shiftMonth(-1)}
          type="button"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="text-sm font-semibold tabular-nums text-[#5C4A32]">
          {formatMonthLabel(monthCursor)}
        </p>
        <button
          aria-label="下一月"
          className="grid size-9 place-items-center rounded-xl text-[#8C6D53] transition-all active:scale-95 hover:bg-[#FFF6D9]"
          onClick={() => shiftMonth(1)}
          type="button"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <section className="relative mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-[#F8A055] via-[#F8C96A] to-[#FFE8B8] p-6 text-[#5C4A32] shadow-sm">
        <div className="absolute -right-10 -top-10 size-36 rounded-full bg-white/25 blur-2xl" />
        <p className="relative text-sm text-[#8A5A12]/90">
          本月{mode === "EXPENSE" ? "总支出" : "总收入"}
        </p>
        <p className="relative mt-3 text-4xl font-semibold tracking-tight">
          {formatHKD(total)}
        </p>
        <p className="relative mt-2 text-xs text-[#8A5A12]/80">
          {formatMonthLabel(monthCursor)} · {filtered.length} 笔
        </p>
      </section>

      <section className="mt-5 rounded-3xl border border-[#EFE5D3] bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[#5C4A32]">分类占比</h2>
        {loading && filtered.length === 0 ? (
          <div className="grid h-56 place-items-center">
            <LoaderCircle className="size-7 animate-spin text-[#F8A055]" />
          </div>
        ) : (
          <div className="mt-2">
            <CategoryPieChart data={pieData} />
          </div>
        )}
      </section>

      <section className="mt-5 rounded-3xl border border-[#EFE5D3] bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[#5C4A32]">近 7 日支出趋势</h2>
        <div className="mt-2">
          <TrendBarChart data={trendData} />
        </div>
      </section>

      <div className="mt-5">
        <BudgetProgressCard stats={budgetStats} />
      </div>
    </main>
  );
}
