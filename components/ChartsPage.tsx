"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  CURRENCY_CODES,
  CURRENCY_META,
  currenciesInTransactions,
  formatMoney,
  normalizeCurrency,
  readDefaultCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import {
  formatSupabaseError,
  queryTransactions,
} from "@/lib/transactions-query";
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
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>("HKD");

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
      const [monthRows, weekRows] = await Promise.all([
        queryTransactions({ gteDate: firstDay, lteDate: lastDay }),
        queryTransactions({ gteDate: weekStart, orderAsc: true }),
      ]);

      setMonthTransactions(monthRows);
      setWeekTransactions(weekRows);

      const codes = currenciesInTransactions([...monthRows, ...weekRows]);
      const preferred = readDefaultCurrency();
      setActiveCurrency((prev) => {
        if (codes.includes(prev)) return prev;
        if (codes.includes(preferred)) return preferred;
        return codes[0] ?? preferred;
      });

      if (showToast) toast.success("统计已更新", { id: "refresh-chart" });
    } catch (error) {
      toast.error(formatSupabaseError(error), {
        id: showToast ? "refresh-chart" : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadChart(), 0);
    return () => window.clearTimeout(timer);
  }, [loadChart]);

  const currencyTabs = useMemo(() => {
    const codes = currenciesInTransactions([
      ...monthTransactions,
      ...weekTransactions,
    ]);
    const preferred = readDefaultCurrency();
    // 固定展示四大常用币种；有账单的排前面，默认币种优先
    const ordered = [
      ...CURRENCY_CODES.filter((c) => c === preferred || codes.includes(c)),
      ...CURRENCY_CODES.filter((c) => c !== preferred && !codes.includes(c)),
    ];
    return Array.from(new Set(ordered));
  }, [monthTransactions, weekTransactions]);

  const totalsByCurrency = useMemo(() => {
    const map = new Map<
      CurrencyCode,
      { expense: number; income: number }
    >();
    for (const code of CURRENCY_CODES) {
      map.set(code, { expense: 0, income: 0 });
    }
    for (const t of monthTransactions) {
      const code = normalizeCurrency(t.currency);
      const slot = map.get(code) ?? { expense: 0, income: 0 };
      if (t.type === "EXPENSE") slot.expense += Number(t.amount);
      else slot.income += Number(t.amount);
      map.set(code, slot);
    }
    return map;
  }, [monthTransactions]);

  const monthForCurrency = useMemo(
    () =>
      monthTransactions.filter(
        (t) => normalizeCurrency(t.currency) === activeCurrency,
      ),
    [monthTransactions, activeCurrency],
  );

  const weekExpenseForCurrency = useMemo(
    () =>
      weekTransactions.filter(
        (t) =>
          t.type === "EXPENSE" &&
          normalizeCurrency(t.currency) === activeCurrency,
      ),
    [weekTransactions, activeCurrency],
  );

  const monthExpense = useMemo(
    () => monthForCurrency.filter((t) => t.type === "EXPENSE"),
    [monthForCurrency],
  );

  const pieData = useMemo(
    () => sumByCategory(monthExpense).slice(0, 4),
    [monthExpense],
  );

  const trendData = useMemo(() => {
    const days = lastNDays(7);
    return days.map((date) => {
      const amount = weekExpenseForCurrency
        .filter((item) => item.date === date)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return {
        date,
        amount,
        label: date.slice(5),
      };
    });
  }, [weekExpenseForCurrency]);

  const meta = CURRENCY_META[activeCurrency];

  return (
    <main className="h-full overflow-y-auto overscroll-contain bg-[#FAF6EC] px-4 pb-5 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-[#F8A055]">消费分析</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#5C4A32]">
            统计
          </h1>
          <p className="mt-1 text-sm text-[#A08B68]">
            各币种独立结算，不做汇率换算
          </p>
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

      {/* 多币种莫兰迪汇总卡 */}
      <div className="mt-4 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 touch-pan-x">
        {currencyTabs.map((code) => {
          const active = code === activeCurrency;
          const m = CURRENCY_META[code];
          const totals = totalsByCurrency.get(code) ?? {
            expense: 0,
            income: 0,
          };
          return (
            <button
              className={`w-[78%] max-w-[280px] shrink-0 rounded-3xl border p-4 text-left shadow-sm transition-all active:scale-[0.98] ${
                m.cardGradient
              } ${
                active
                  ? "border-[#F8A055] ring-2 ring-[#F8A055]/35"
                  : "border-white/70"
              }`}
              key={code}
              onClick={() => setActiveCurrency(code)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#5C4A32]">
                  {m.flag} {code} {m.label}
                </p>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-[#8C6D53]">
                  {m.symbol}
                </span>
              </div>
              <p className="mt-3 text-xs text-[#A08875]">本月支出</p>
              <p className="mt-0.5 text-xl font-extrabold tracking-tight text-[#E07A3D]">
                {formatMoney(totals.expense, code)}
              </p>
              <p className="mt-2 text-xs text-[#A08875]">
                本月收入{" "}
                <span className="font-semibold text-[#2A9D8F]">
                  {formatMoney(totals.income, code)}
                </span>
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <section className="rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[#5C4A32]">
            近 7 日支出趋势 · {activeCurrency}
          </h2>
          <div className="mt-1">
            {loading && weekTransactions.length === 0 ? (
              <div className="grid h-56 place-items-center">
                <LoaderCircle className="size-6 animate-spin text-[#F8A055]" />
              </div>
            ) : (
              <TrendBarChart currency={activeCurrency} data={trendData} />
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[#5C4A32]">
            支出分类占比 Top 4 · {activeCurrency}
          </h2>
          {loading && monthTransactions.length === 0 ? (
            <div className="grid h-40 place-items-center">
              <LoaderCircle className="size-6 animate-spin text-[#F8A055]" />
            </div>
          ) : (
            <div className="mt-1">
              <CategoryPieChart currency={activeCurrency} data={pieData} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
