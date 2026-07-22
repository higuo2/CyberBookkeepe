"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LoaderCircle,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { CategoryIcon } from "@/components/CategoryIcon";
import { TransactionDialog } from "@/components/TransactionDialog";
import { categoryColor } from "@/lib/category-colors";
import {
  insertTransactionDraft,
  updateTransactionDraft,
} from "@/lib/recurring-sync";
import {
  formatSupabaseError,
  queryTransactions,
} from "@/lib/transactions-query";
import { getSupabase } from "@/lib/supabase";
import {
  createEmptyTransaction,
  EXPENSE_CATEGORIES,
  formatMoney,
  INCOME_CATEGORIES,
  prepareDraft,
} from "@/lib/transaction-utils";
import {
  CURRENCY_CODES,
  CURRENCY_META,
  normalizeCurrency,
  readDefaultCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import type { Transaction, TransactionDraft, TransactionType } from "@/lib/types";
import {
  cleanNote,
  isRecurringNote,
  markRecurringTxSkipped,
  withPreservedRecTags,
} from "@/lib/utils";

const TYPE_SEGMENTS: { key: "ALL" | TransactionType; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "EXPENSE", label: "支出" },
  { key: "INCOME", label: "收入" },
];

function displayCategory(category: string) {
  return category === "居住" ? "住房" : category;
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

/** 同日同币种合计；严禁跨币种相加 */
function dayTotalsByCurrency(items: Transaction[]) {
  const map = new Map<CurrencyCode, { expense: number; income: number }>();
  for (const item of items) {
    const c = normalizeCurrency(item.currency);
    const row = map.get(c) ?? { expense: 0, income: 0 };
    if (item.type === "EXPENSE") row.expense += Number(item.amount);
    else row.income += Number(item.amount);
    map.set(c, row);
  }
  return [...map.entries()];
}

function formatDayExpenseSummary(
  items: Transaction[],
  preferred: CurrencyCode,
): string {
  const totals = dayTotalsByCurrency(items).filter(([, s]) => s.expense > 0);
  if (totals.length === 0) return "";
  totals.sort(([a], [b]) => {
    if (a === preferred) return -1;
    if (b === preferred) return 1;
    return a.localeCompare(b);
  });
  return totals
    .map(([code, sums]) => `支 ${formatMoney(sums.expense, code)}`)
    .join(" · ");
}

function categoryIconTone(category: string) {
  const color = categoryColor(category);
  return {
    backgroundColor: `${color}26`,
    color,
  };
}

function headerBtnClass(active = false) {
  return `grid size-9 place-items-center rounded-full border transition-all active:scale-95 ${
    active
      ? "border-[#F8A055]/40 bg-[#FFF1E0] text-[#E07A3D]"
      : "border-black/5 bg-white text-[#6B5B4A] shadow-sm"
  }`;
}

export function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"ALL" | TransactionType>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [currencyFilter, setCurrencyFilter] = useState<"ALL" | CurrencyCode>(
    "ALL",
  );
  const [defaultCurrency, setDefaultCurrency] =
    useState<CurrencyCode>("HKD");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingIsRecurring, setEditingIsRecurring] = useState(false);
  const [draft, setDraft] = useState<TransactionDraft>(createEmptyTransaction);
  const [mutating, setMutating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTransactions = useCallback(async () => {
    await Promise.resolve();
    if (!navigator.onLine) {
      toast.error("当前无网络，无法读取账单");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await queryTransactions();
      setTransactions(rows);
    } catch (error) {
      toast.error(formatSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDefaultCurrency(readDefaultCurrency());
    const timer = window.setTimeout(() => void loadTransactions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTransactions]);

  useEffect(() => {
    if (categoryFilter === "ALL") return;
    const allowed =
      typeFilter === "EXPENSE"
        ? EXPENSE_CATEGORIES
        : typeFilter === "INCOME"
          ? INCOME_CATEGORIES
          : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
    if (!allowed.includes(categoryFilter as never)) {
      setCategoryFilter("ALL");
    }
  }, [typeFilter, categoryFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((item) => {
      if (recurringOnly && !isRecurringNote(item.note)) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }
      if (
        currencyFilter !== "ALL" &&
        normalizeCurrency(item.currency) !== currencyFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        cleanNote(item.note).toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        String(item.amount).includes(q) ||
        normalizeCurrency(item.currency).toLowerCase().includes(q)
      );
    });
  }, [
    transactions,
    query,
    typeFilter,
    categoryFilter,
    recurringOnly,
    currencyFilter,
  ]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Transaction[]>>((groups, item) => {
      (groups[item.date] ??= []).push(item);
      return groups;
    }, {});
  }, [filtered]);

  const filterActiveCount = useMemo(() => {
    let n = 0;
    if (currencyFilter !== "ALL") n += 1;
    if (categoryFilter !== "ALL") n += 1;
    if (recurringOnly) n += 1;
    return n;
  }, [currencyFilter, categoryFilter, recurringOnly]);

  const categoryOptions = useMemo(() => {
    if (typeFilter === "EXPENSE") return [...EXPENSE_CATEGORIES];
    if (typeFilter === "INCOME") return [...INCOME_CATEGORIES];
    return [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  }, [typeFilter]);

  function openCreate() {
    setDraft(createEmptyTransaction("EXPENSE", readDefaultCurrency()));
    setEditingId(null);
    setEditingIsRecurring(false);
    setDialogMode("create");
  }

  function openEdit(transaction: Transaction) {
    setDraft({
      amount: Number(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      note: cleanNote(transaction.note),
      currency: normalizeCurrency(transaction.currency),
    });
    setEditingId(transaction.id ?? null);
    setEditingIsRecurring(isRecurringNote(transaction.note));
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
    const prepared = prepareDraft(draft);
    const originalNote = isEditing
      ? transactions.find((item) => item.id === editingId)?.note
      : undefined;
    const cleanDraft = {
      ...prepared,
      note: withPreservedRecTags(prepared.note, originalNote),
    };
    try {
      if (isEditing) {
        if (!editingId) throw new Error("该账单缺少 ID，无法更新");
        await updateTransactionDraft(editingId, cleanDraft);
      } else {
        await insertTransactionDraft(cleanDraft);
      }
      setDialogMode(null);
      toast.success(isEditing ? "账单已更新" : "账单已新增", { id: toastId });
      await loadTransactions();
    } catch (error) {
      toast.error(formatSupabaseError(error), { id: toastId });
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

    const original = transactions.find((item) => item.id === editingId);
    const isRecurring = isRecurringNote(original?.note);

    if (
      !window.confirm(
        isRecurring
          ? `确定跳过本期「${cleanNote(draft.note) || draft.category}」吗？跳过后不会再自动生成这一期。`
          : `确定彻底删除「${cleanNote(draft.note) || draft.category}」吗？`,
      )
    ) {
      return;
    }
    setDeleting(true);
    const toastId = toast.loading(
      isRecurring ? "正在跳过本期…" : "正在删除账单…",
    );
    try {
      if (isRecurring && original) {
        const { error } = await getSupabase()
          .from("transactions")
          .update({ note: markRecurringTxSkipped(original.note) })
          .eq("id", editingId);
        if (error) throw error;
        setTransactions((current) =>
          current.filter((item) => item.id !== editingId),
        );
        toast.success("已跳过本期，不会再自动生成", { id: toastId });
      } else {
        const { error } = await getSupabase()
          .from("transactions")
          .delete()
          .eq("id", editingId);
        if (error) throw error;
        setTransactions((current) =>
          current.filter((item) => item.id !== editingId),
        );
        toast.success("账单已删除", { id: toastId });
      }
      setDialogMode(null);
      setEditingId(null);
      setEditingIsRecurring(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "操作失败，请稍后重试",
        { id: toastId },
      );
    } finally {
      setDeleting(false);
    }
  }

  function resetFilters() {
    setCurrencyFilter("ALL");
    setCategoryFilter("ALL");
    setRecurringOnly(false);
  }

  function goManageRecurring() {
    setDialogMode(null);
    router.push("/summary");
  }

  return (
    <>
      <main className="relative flex h-full min-h-0 flex-col bg-[#F7F4EE] pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
        <header className="shrink-0 px-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-[#C4A484]">
                账单历史
              </p>
              <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight text-[#3D3429]">
                账单
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                aria-label={searchOpen ? "收起搜索" : "展开搜索"}
                className={headerBtnClass(searchOpen || Boolean(query.trim()))}
                onClick={() =>
                  setSearchOpen((open) => {
                    if (open) setQuery("");
                    return !open;
                  })
                }
                type="button"
              >
                {searchOpen ? (
                  <X className="size-4" strokeWidth={2.25} />
                ) : (
                  <Search className="size-4" strokeWidth={2.25} />
                )}
              </button>
              <button
                aria-label="手动记账"
                className="grid size-9 place-items-center rounded-full bg-[#3D3429] text-white shadow-sm transition-all active:scale-95"
                onClick={openCreate}
                type="button"
              >
                <Plus className="size-4.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {searchOpen ? (
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-[#C0B49A]" />
              <input
                autoFocus
                className="h-10 w-full rounded-2xl border border-black/5 bg-white pl-10 pr-3 text-sm text-[#3D3429] outline-none shadow-sm transition-all placeholder:text-[#C0B49A] focus:border-[#D4C4A8] focus:ring-2 focus:ring-[#E8DCC8]/60"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索备注、分类或金额"
                value={query}
              />
            </label>
          ) : null}

          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex min-w-0 flex-1 rounded-xl bg-[#EBE6DC] p-[3px]">
              {TYPE_SEGMENTS.map(({ key, label }) => {
                const active = typeFilter === key;
                return (
                  <button
                    className={`h-8 flex-1 rounded-[10px] text-[13px] font-semibold transition-all active:scale-[0.98] ${
                      active
                        ? "bg-white text-[#3D3429] shadow-sm"
                        : "text-[#8A7A68]"
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

            <button
              aria-label="更多筛选"
              className={`flex h-9 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[13px] font-semibold transition-all active:scale-95 ${
                filterActiveCount > 0
                  ? "border-[#E8D5B5] bg-[#FFF6E8] text-[#9A6B3A]"
                  : "border-black/5 bg-white text-[#6B5B4A] shadow-sm"
              }`}
              onClick={() => setFilterOpen(true)}
              type="button"
            >
              <Settings2 className="size-3.5" strokeWidth={2.25} />
              <span>筛选</span>
              {filterActiveCount > 0 ? (
                <span className="grid size-4 place-items-center rounded-full bg-[#E07A3D] text-[10px] font-bold text-white">
                  {filterActiveCount}
                </span>
              ) : (
                <ChevronDown className="size-3.5 opacity-50" />
              )}
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 touch-pan-y">
          {loading && transactions.length === 0 ? (
            <div className="grid min-h-60 place-items-center">
              <LoaderCircle className="size-7 animate-spin text-[#C4A484]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-black/8 bg-white/70 px-5 py-14 text-center">
              <p className="font-medium text-[#3D3429]">没有匹配的账单</p>
              <p className="mt-1 text-sm text-[#9A8B78]">
                {recurringOnly
                  ? "暂无周期账单，试试关闭「仅看周期」"
                  : "试试调整筛选，或点右上角 + 新增"}
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {Object.entries(grouped).map(([date, items]) => {
                const dayExpense = formatDayExpenseSummary(
                  items,
                  defaultCurrency,
                );
                return (
                  <section key={date}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                      <h2 className="font-medium text-gray-700">
                        {displayDate(date)}
                      </h2>
                      {dayExpense ? (
                        <p className="truncate text-[12px] font-medium text-gray-400">
                          {dayExpense}
                        </p>
                      ) : null}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm divide-y divide-gray-100">
                      {items.map((item, index) => {
                        const expense = item.type === "EXPENSE";
                        const recurring = isRecurringNote(item.note);
                        const currency = normalizeCurrency(item.currency);
                        const showCurrencyChip = currency !== defaultCurrency;
                        const note = cleanNote(item.note) || item.category;
                        const tone = categoryIconTone(item.category);

                        return (
                          <button
                            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-gray-50/80"
                            key={item.id ?? `${date}-${index}`}
                            onClick={() => openEdit(item)}
                            type="button"
                          >
                            <div
                              className="grid size-10 shrink-0 place-items-center rounded-2xl"
                              style={tone}
                            >
                              <CategoryIcon
                                category={item.category}
                                className="size-4.5"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-gray-800">
                                {displayCategory(item.category)}
                              </p>
                              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-400">
                                <span className="truncate">{note}</span>
                                {recurring ? (
                                  <span
                                    aria-label="周期账单"
                                    className="inline-flex shrink-0 items-center rounded-full bg-sky-50 px-1 py-px text-[10px] text-sky-500"
                                    title="周期账单"
                                  >
                                    🔄
                                  </span>
                                ) : null}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              {showCurrencyChip ? (
                                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500">
                                  {currency}
                                </span>
                              ) : null}
                              <p
                                className={`text-[15px] font-semibold tabular-nums ${
                                  expense
                                    ? "text-[#6B5344]"
                                    : "text-[#5B8F7B]"
                                }`}
                              >
                                {expense ? "-" : "+"}
                                {formatMoney(item.amount, currency)}
                              </p>
                            </div>
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

      <BottomSheet
        contentClassName="max-h-[75vh] overflow-y-auto overscroll-contain scrollbar-none px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] touch-pan-y"
        onOpenChange={setFilterOpen}
        open={filterOpen}
        title="筛选"
      >
        <div className="space-y-5 pt-1">
          <section>
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#A08875]">
              选择币种
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-all active:scale-95 ${
                  currencyFilter === "ALL"
                    ? "bg-[#3D3429] text-white"
                    : "bg-[#F3ECE0] text-[#6B5B4A]"
                }`}
                onClick={() => setCurrencyFilter("ALL")}
                type="button"
              >
                全部
              </button>
              {CURRENCY_CODES.map((code) => {
                const meta = CURRENCY_META[code];
                const active = currencyFilter === code;
                return (
                  <button
                    className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-all active:scale-95 ${
                      active
                        ? "bg-[#3D3429] text-white"
                        : "bg-[#F3ECE0] text-[#6B5B4A]"
                    }`}
                    key={code}
                    onClick={() => setCurrencyFilter(code)}
                    type="button"
                  >
                    {meta.flag} {code}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#A08875]">
              分类筛选
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-all active:scale-95 ${
                  categoryFilter === "ALL"
                    ? "bg-[#3D3429] text-white"
                    : "bg-[#F3ECE0] text-[#6B5B4A]"
                }`}
                onClick={() => setCategoryFilter("ALL")}
                type="button"
              >
                全部
              </button>
              {categoryOptions.map((category) => {
                const active = categoryFilter === category;
                return (
                  <button
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all active:scale-95 ${
                      active
                        ? "bg-[#3D3429] text-white"
                        : "bg-[#F3ECE0] text-[#6B5B4A]"
                    }`}
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    type="button"
                  >
                    <CategoryIcon category={category} className="size-3.5" />
                    {displayCategory(category)}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#A08875]">
              仅看周期
            </p>
            <button
              className={`flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold transition-all active:scale-[0.99] ${
                recurringOnly
                  ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                  : "bg-[#F3ECE0] text-[#6B5B4A]"
              }`}
              onClick={() => setRecurringOnly((v) => !v)}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <span>🔄</span>
                只显示周期自动账单
              </span>
              <span
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  recurringOnly ? "bg-sky-500" : "bg-[#D8CFC0]"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                    recurringOnly ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          </section>

          {filterActiveCount > 0 ? (
            <button
              className="flex h-11 w-full items-center justify-center rounded-2xl bg-[#F3ECE0] text-sm font-semibold text-[#A08875] transition-all active:scale-[0.99]"
              onClick={resetFilters}
              type="button"
            >
              清除筛选
            </button>
          ) : null}

          <button
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#3D3429] text-sm font-semibold text-white transition-all active:scale-[0.99]"
            onClick={() => setFilterOpen(false)}
            type="button"
          >
            完成
          </button>
        </div>
      </BottomSheet>

      <TransactionDialog
        busy={mutating}
        deleting={deleting}
        isRecurring={dialogMode === "edit" && editingIsRecurring}
        onChange={setDraft}
        onClose={() => !mutating && !deleting && setDialogMode(null)}
        onDelete={dialogMode === "edit" ? deleteFromDialog : undefined}
        onManageRecurring={
          dialogMode === "edit" && editingIsRecurring
            ? goManageRecurring
            : undefined
        }
        onSubmit={saveDraft}
        open={dialogMode !== null}
        submitLabel={dialogMode === "edit" ? "保存" : "新增账单"}
        title={dialogMode === "edit" ? "账单详情" : "手动记账"}
        value={draft}
      />
    </>
  );
}
