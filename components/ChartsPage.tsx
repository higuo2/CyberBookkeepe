"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw, TrendingDown } from "lucide-react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import type { Transaction } from "@/lib/types";

const COLORS = ["#059669", "#0f766e", "#65a30d", "#d97706", "#ea580c", "#e11d48"];

function money(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(amount);
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ChartsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChart = useCallback(async (showToast = false) => {
    await Promise.resolve();

    if (!navigator.onLine) {
      toast.error("当前无网络，无法读取图表");
      setLoading(false);
      return;
    }

    const now = new Date();
    const firstDay = toDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastDay = toDateString(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    );

    if (showToast) toast.loading("正在刷新图表…", { id: "refresh-chart" });
    setLoading(true);

    try {
      const { data, error } = await getSupabase()
        .from("transactions")
        .select("id, amount, type, category, date, note")
        .eq("type", "EXPENSE")
        .gte("date", firstDay)
        .lte("date", lastDay)
        .order("date", { ascending: false });
      if (error) throw error;

      setTransactions((data ?? []) as Transaction[]);
      if (showToast) toast.success("图表已更新", { id: "refresh-chart" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "读取失败，请稍后重试";
      toast.error(message, showToast ? { id: "refresh-chart" } : undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadChart(), 0);
    return () => window.clearTimeout(timer);
  }, [loadChart]);

  const total = transactions.reduce((sum, item) => sum + Number(item.amount), 0);
  const chartData = useMemo(() => {
    const categories = transactions.reduce<Record<string, number>>(
      (result, item) => {
        result[item.category] =
          (result[item.category] ?? 0) + Number(item.amount);
        return result;
      },
      {},
    );
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  return (
    <main className="px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-600">消费分析</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">
            图表
          </h1>
        </div>
        <button
          aria-label="刷新图表"
          className="grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition active:scale-95 disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadChart(true)}
          type="button"
        >
          <RefreshCw className={`size-4.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] bg-stone-950 p-6 text-white shadow-xl shadow-stone-300">
        <div className="flex items-center gap-2 text-stone-400">
          <TrendingDown className="size-4" />
          <p className="text-sm font-medium">本月总支出</p>
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-tight">{money(total)}</p>
        <p className="mt-2 text-xs text-stone-500">
          {new Date().getMonth() + 1} 月 · {transactions.length} 笔支出
        </p>
      </section>

      <section className="mt-5 rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-stone-900">分类占比</h2>
        {loading && transactions.length === 0 ? (
          <div className="grid h-80 place-items-center">
            <LoaderCircle className="size-7 animate-spin text-emerald-600" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="grid h-80 place-items-center text-center">
            <div>
              <p className="font-medium text-stone-600">本月暂无支出</p>
              <p className="mt-1 text-sm text-stone-400">记账后即可查看分析</p>
            </div>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="45%"
                  data={chartData}
                  dataKey="value"
                  innerRadius={58}
                  nameKey="name"
                  outerRadius={90}
                  paddingAngle={3}
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      fill={COLORS[index % COLORS.length]}
                      key={entry.name}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e7e5e4",
                    borderRadius: "12px",
                    boxShadow: "0 8px 24px rgba(0,0,0,.08)",
                  }}
                  formatter={(value) => money(Number(value))}
                />
                <Legend
                  iconSize={8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", color: "#57534e" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}
