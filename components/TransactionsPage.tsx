"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CategoryFilterDropdown } from "@/components/CategoryFilterDropdown";
import { TransactionDialog } from "@/components/TransactionDialog";
import { exportTransactionsToXlsx } from "@/lib/export";
import { getSupabase } from "@/lib/supabase";
import {
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

function dayExpenseTotal(items: Transaction[]) {
  return items
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

function dayIncomeTotal(items: Transaction[]) {
  return items
    .filter((item) => item.type === "INCOME")
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

const TYPE_PILLS: { key: "ALL" | TransactionType; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "EXPENSE", label: "支出" },
  { key: "INCOME", label: "收入" },
];

const iconBtn =
  "grid size-9 place-items-center rounded-full border border-[#EFE5D3] bg-white text-[#8A7A5C] shadow-sm transition-all active:scale-95 disabled:opacity-50";

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
  const [deleting, setDeleting] = useState(false);

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

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Transaction[]>>((groups, item) => {
      (groups[item.date] ??= []).push(item);
      return groups;
    }, {});
  }, [filtered]);

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

  async function deleteFromDialog() {
    if (!editingId) {
      toast.error("该账单缺少 ID，无法删除");
      return;
    }
    if (!navigator.onLine) {
      toast.error("当前无网络，无法删除账单");
      return;
    }
    if (!window.confirm(`确定彻底删除「${draft.note || draft.category}」吗？`)) {
      return;
    }
    setDeleting(true);
    const toastId = toast.loading("正在删除账单…");
    try {
      const { error } = await getSupabase()
        .from("transactions")
        .delete()
        .eq("id", editingId);
      if (error) throw error;
      setTransactions((current) =>
        current.filter((item) => item.id !== editingId),
      );
      setDialogMode(null);
      setEditingId(null);
      toast.success("账单已删除", { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "删除失败，请稍后重试",
        { id: toastId },
      );
    } finally {
      setDeleting(false);
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
      <main className="relative flex h-full min-h-0 flex-col bg-[#FAF6EC] pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
        <header className="shrink-0 px-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#F8A055]">账单历史</p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#5C4A32]">
                账单
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                aria-label="导出报表"
                className={iconBtn}
                onClick={handleExport}
                type="button"
              >
                <Download className="size-4" />
              </button>
              <button
                aria-label="刷新账单"
                className={iconBtn}
                disabled={loading}
                onClick={() => void loadTransactions(true)}
                type="button"
              >
                <RefreshCw
                  className={`size-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
              <button
                aria-label="手动记账"
                className="grid size-9 place-items-center rounded-full bg-[#F8A055] text-white shadow-sm transition-all active:scale-95"
                onClick={openCreate}
                type="button"
              >
                <Plus className="size-4.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#C0B49A]" />
              <input
                className="h-9 w-full rounded-xl border border-[#EFE5D3] bg-white pl-9 pr-3 text-sm text-[#5C4A32] outline-none shadow-sm transition-all focus:border-[#F8A055] focus:ring-2 focus:ring-[#F8A055]/15"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索备注、分类或金额"
                value={query}
              />
            </label>

            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-1 rounded-xl bg-[#FFF6D9] p-0.5">
                {TYPE_PILLS.map(({ key, label }) => {
                  const active = typeFilter === key;
                  return (
                    <button
                      className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                        active
                          ? "bg-white text-[#5C4A32] shadow-sm"
                          : "text-[#A08B68]"
                      }`}
                      key={key}
                      onClick={() => setTypeFilter(key)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <CategoryFilterDropdown
                onChange={setCategoryFilter}
                typeFilter={typeFilter}
                value={categoryFilter}
              />
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 touch-pan-y">
          {loading && transactions.length === 0 ? (
            <div className="grid min-h-60 place-items-center">
              <LoaderCircle className="size-7 animate-spin text-[#F8A055]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#EFE5D3] bg-white px-5 py-12 text-center shadow-sm">
              <p className="font-medium text-[#5C4A32]">没有匹配的账单</p>
              <p className="mt-1 text-sm text-[#A08B68]">
                试试调整筛选，或点右上角 + 新增
              </p>
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              {Object.entries(grouped).map(([date, items]) => {
                const expenseSum = dayExpenseTotal(items);
                const incomeSum = dayIncomeTotal(items);
                return (
                  <section key={date}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
                      <h2 className="text-sm font-semibold text-[#9A7B55]">
                        {displayDate(date)}
                      </h2>
                      <p className="shrink-0 text-xs font-medium text-[#A08B68]">
                        {expenseSum > 0
                          ? `支出 ${formatHKD(expenseSum)}`
                          : incomeSum > 0
                            ? `收入 ${formatHKD(incomeSum)}`
                            : null}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {items.map((item, index) => {
                        const expense = item.type === "EXPENSE";
                        return (
                          <button
                            className="flex w-full items-center gap-3 rounded-2xl border border-[#EFE5D3] bg-white px-3 py-2.5 text-left shadow-sm transition-all active:scale-[0.99]"
                            key={item.id ?? `${date}-${index}`}
                            onClick={() => openEdit(item)}
                            type="button"
                          >
                            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#FFF6D9] text-[#8A5A12]">
                              <CategoryIcon
                                category={item.category}
                                className="size-4.5"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#5C4A32]">
                                {item.category === "居住"
                                  ? "住房"
                                  : item.category}
                              </p>
                              <p className="truncate text-xs text-[#A08B68]">
                                {item.note || item.category}
                              </p>
                            </div>
                            <p
                              className={`shrink-0 text-sm font-semibold tabular-nums ${
                                expense ? "text-[#E07A3D]" : "text-[#2A9D8F]"
                              }`}
                            >
                              {expense ? "-" : "+"}
                              {formatHKD(item.amount)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <TransactionDialog
        busy={mutating}
        deleting={deleting}
        onChange={setDraft}
        onClose={() => !mutating && !deleting && setDialogMode(null)}
        onDelete={dialogMode === "edit" ? deleteFromDialog : undefined}
        onSubmit={saveDraft}
        open={dialogMode !== null}
        submitLabel={dialogMode === "edit" ? "保存" : "新增账单"}
        title={dialogMode === "edit" ? "账单详情" : "手动记账"}
        value={draft}
      />
    </>
  );
}
