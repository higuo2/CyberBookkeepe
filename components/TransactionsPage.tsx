"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import type { Transaction } from "@/lib/types";

function money(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(amount);
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async (showToast = false) => {
    await Promise.resolve();

    if (!navigator.onLine) {
      toast.error("当前无网络，无法读取明细");
      setLoading(false);
      return;
    }

    if (showToast) toast.loading("正在刷新账单…", { id: "refresh-list" });
    setLoading(true);

    try {
      const { data, error } = await getSupabase()
        .from("transactions")
        .select("id, amount, type, category, date, note")
        .order("date", { ascending: false });
      if (error) throw error;

      setTransactions((data ?? []) as Transaction[]);
      if (showToast) toast.success("明细已更新", { id: "refresh-list" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "读取失败，请稍后重试";
      toast.error(message, showToast ? { id: "refresh-list" } : undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTransactions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTransactions]);

  const grouped = transactions.reduce<Record<string, Transaction[]>>(
    (groups, item) => {
      (groups[item.date] ??= []).push(item);
      return groups;
    },
    {},
  );

  return (
    <main className="px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-600">账单历史</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">
            明细
          </h1>
        </div>
        <button
          aria-label="刷新账单"
          className="grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition active:scale-95 disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadTransactions(true)}
          type="button"
        >
          <RefreshCw className={`size-4.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {loading && transactions.length === 0 ? (
        <div className="grid min-h-80 place-items-center">
          <LoaderCircle className="size-7 animate-spin text-emerald-600" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="mt-8 rounded-[1.75rem] border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <p className="font-medium text-stone-700">还没有账单</p>
          <p className="mt-1 text-sm text-stone-400">记下第一笔收支吧</p>
        </div>
      ) : (
        <div className="mt-8 space-y-7">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-semibold text-stone-500">
                {displayDate(date)}
              </h2>
              <div className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-sm">
                {items.map((item, index) => {
                  const expense = item.type === "EXPENSE";
                  return (
                    <article
                      className={`flex items-center gap-3 p-4 ${
                        index > 0 ? "border-t border-stone-100" : ""
                      }`}
                      key={item.id ?? `${date}-${index}`}
                    >
                      <div
                        className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                          expense
                            ? "bg-rose-50 text-rose-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {expense ? (
                          <ArrowDownLeft className="size-5" />
                        ) : (
                          <ArrowUpRight className="size-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-900">
                          {item.category}
                        </p>
                        <p className="truncate text-sm text-stone-400">
                          {item.note}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 font-semibold ${
                          expense ? "text-stone-900" : "text-emerald-600"
                        }`}
                      >
                        {expense ? "−" : "+"}
                        {money(item.amount)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
