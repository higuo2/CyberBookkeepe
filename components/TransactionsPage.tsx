"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/CategoryIcon";
import { TransactionDialog } from "@/components/TransactionDialog";
import { exportTransactionsToXlsx } from "@/lib/export";
import { getSupabase } from "@/lib/supabase";
import {
  CATEGORIES,
  createEmptyTransaction,
  formatHKD,
  prepareDraft,
} from "@/lib/transaction-utils";
import type { Transaction, TransactionDraft, TransactionType } from "@/lib/types";

function displayDate(date: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | TransactionType>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TransactionDraft>(createEmptyTransaction);
  const [mutating, setMutating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTransactions = useCallback(async (showToast = false) => {
    await Promise.resolve();
    if (!navigator.onLine) {
      toast.error("当前无网络，无法读取账单");
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
      if (showToast) toast.success("账单已更新", { id: "refresh-list" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "读取失败，请稍后重试",
        showToast ? { id: "refresh-list" } : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTransactions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTransactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((item) => {
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.note.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        String(item.amount).includes(q)
      );
    });
  }, [transactions, query, typeFilter, categoryFilter]);

  const grouped = filtered.reduce<Record<string, Transaction[]>>(
    (groups, item) => {
      (groups[item.date] ??= []).push(item);
      return groups;
    },
    {},
  );

  function openCreate() {
    setDraft(createEmptyTransaction());
    setEditingId(null);
    setDialogMode("create");
  }

  function openEdit(transaction: Transaction) {
    setDraft({
      amount: Number(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      note: transaction.note,
    });
    setEditingId(transaction.id ?? null);
    setDialogMode("edit");
  }

  async function saveDraft() {
    if (!navigator.onLine) {
      toast.error("当前无网络，无法保存账单");
      return;
    }
    setMutating(true);
    const isEditing = dialogMode === "edit";
    const toastId = toast.loading(isEditing ? "正在更新账单…" : "正在新增账单…");
    const cleanDraft = prepareDraft(draft);
    try {
      if (isEditing) {
        if (!editingId) throw new Error("该账单缺少 ID，无法更新");
        const { error } = await getSupabase()
          .from("transactions")
          .update(cleanDraft)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await getSupabase()
          .from("transactions")
          .insert(cleanDraft);
        if (error) throw error;
      }
      setDialogMode(null);
      toast.success(isEditing ? "账单已更新" : "账单已新增", { id: toastId });
      await loadTransactions();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请稍后重试",
        { id: toastId },
      );
    } finally {
      setMutating(false);
    }
  }

  async function deleteTransaction(transaction: Transaction) {
    if (!transaction.id) {
      toast.error("该账单缺少 ID，无法删除");
      return;
    }
    if (!navigator.onLine) {
      toast.error("当前无网络，无法删除账单");
      return;
    }
    if (!window.confirm(`确定彻底删除「${transaction.note || transaction.category}」吗？`)) {
      return;
    }
    setDeletingId(transaction.id);
    const toastId = toast.loading("正在删除账单…");
    try {
      const { error } = await getSupabase()
        .from("transactions")
        .delete()
        .eq("id", transaction.id);
      if (error) throw error;
      setTransactions((current) =>
        current.filter((item) => item.id !== transaction.id),
      );
      toast.success("账单已删除", { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "删除失败，请稍后重试",
        { id: toastId },
      );
    } finally {
      setDeletingId(null);
    }
  }

  function handleExport() {
    if (filtered.length === 0) {
      toast.error("当前没有可导出的账单");
      return;
    }
    exportTransactionsToXlsx(filtered);
    toast.success(`已导出 ${filtered.length} 笔账单`);
  }

  return (
    <>
      <main className="h-full overflow-y-auto overscroll-contain bg-[#FAF6EC] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
        <header>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold text-[#F8A055]">账单历史</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#5C4A32]">
                账单
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                aria-label="导出报表"
                className="grid size-11 place-items-center rounded-full border border-[#EFE5D3] bg-white text-[#8A7A5C] shadow-sm transition-all active:scale-95"
                onClick={handleExport}
                type="button"
              >
                <Download className="size-4.5" />
              </button>
              <button
                aria-label="刷新账单"
                className="grid size-11 place-items-center rounded-full border border-[#EFE5D3] bg-white text-[#8A7A5C] shadow-sm transition-all active:scale-95 disabled:opacity-50"
                disabled={loading}
                onClick={() => void loadTransactions(true)}
                type="button"
              >
                <RefreshCw className={`size-4.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#C0B49A]" />
              <input
                className="h-12 w-full rounded-2xl border border-[#EFE5D3] bg-white pl-10 pr-4 text-sm text-[#5C4A32] outline-none shadow-sm transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索备注、分类或金额"
                value={query}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-11 rounded-2xl border border-[#EFE5D3] bg-white px-3 text-sm text-[#5C4A32] outline-none shadow-sm"
                onChange={(event) =>
                  setTypeFilter(event.target.value as "ALL" | TransactionType)
                }
                value={typeFilter}
              >
                <option value="ALL">全部类型</option>
                <option value="EXPENSE">支出</option>
                <option value="INCOME">收入</option>
              </select>
              <select
                className="h-11 rounded-2xl border border-[#EFE5D3] bg-white px-3 text-sm text-[#5C4A32] outline-none shadow-sm"
                onChange={(event) => setCategoryFilter(event.target.value)}
                value={categoryFilter}
              >
                <option value="ALL">全部分类</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A055] text-sm font-semibold text-white shadow-sm transition-all active:scale-95"
            onClick={openCreate}
            type="button"
          >
            <Plus className="size-5" />
            手动记账
          </button>
        </header>

        {loading && transactions.length === 0 ? (
          <div className="grid min-h-80 place-items-center">
            <LoaderCircle className="size-7 animate-spin text-[#F8A055]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[#EFE5D3] bg-white px-6 py-14 text-center shadow-sm">
            <p className="font-medium text-[#5C4A32]">没有匹配的账单</p>
            <p className="mt-1 text-sm text-[#A08B68]">试试调整筛选或新增一笔</p>
          </div>
        ) : (
          <div className="mt-8 space-y-7">
            {Object.entries(grouped).map(([date, items]) => (
              <section key={date}>
                <h2 className="mb-3 text-sm font-semibold text-[#9A7B55]">
                  {displayDate(date)}
                </h2>
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const expense = item.type === "EXPENSE";
                    const deleting = deletingId === item.id;
                    return (
                      <article
                        className="rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm"
                        key={item.id ?? `${date}-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                              expense
                                ? "bg-[#FFF6D9] text-[#E07A3D]"
                                : "bg-[#E8F8F4] text-[#2A9D8F]"
                            }`}
                          >
                            <CategoryIcon category={item.category} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-[#5C4A32]">
                                {item.category}
                              </p>
                              {expense ? (
                                <ArrowDownLeft className="size-3.5 text-[#E07A3D]" />
                              ) : (
                                <ArrowUpRight className="size-3.5 text-[#2A9D8F]" />
                              )}
                            </div>
                            <p className="truncate text-sm text-[#A08B68]">
                              {item.note}
                            </p>
                          </div>
                          <p
                            className={`shrink-0 font-semibold ${
                              expense ? "text-[#E07A3D]" : "text-[#2A9D8F]"
                            }`}
                          >
                            {expense ? "−" : "+"}
                            {formatHKD(item.amount)}
                          </p>
                        </div>
                        <div className="mt-3 flex justify-end gap-2 border-t border-[#EFE5D3] pt-3">
                          <button
                            className="flex h-9 items-center gap-1.5 rounded-full bg-[#FFF6D9] px-3 text-xs font-semibold text-[#8A7A5C] transition-all active:scale-95"
                            onClick={() => openEdit(item)}
                            type="button"
                          >
                            <Pencil className="size-3.5" />
                            编辑
                          </button>
                          <button
                            className="flex h-9 items-center gap-1.5 rounded-full bg-[#FFE8E0] px-3 text-xs font-semibold text-[#E07A3D] transition-all active:scale-95 disabled:opacity-50"
                            disabled={deleting}
                            onClick={() => void deleteTransaction(item)}
                            type="button"
                          >
                            {deleting ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            删除
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <TransactionDialog
        busy={mutating}
        onChange={setDraft}
        onClose={() => !mutating && setDialogMode(null)}
        onSubmit={saveDraft}
        open={dialogMode !== null}
        submitLabel={dialogMode === "edit" ? "保存修改" : "新增账单"}
        title={dialogMode === "edit" ? "编辑账单" : "手动记账"}
        value={draft}
      />
    </>
  );
}
