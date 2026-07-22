"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LayoutGrid,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { RecurringBadgeIcon } from "@/components/AppIcons";
import { BottomSheet } from "@/components/BottomSheet";
import { CategoryIcon } from "@/components/CategoryIcon";
import { TransactionDialog } from "@/components/TransactionDialog";
import { TransactionListSkeleton } from "@/components/ui/Skeleton";
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
  categoryLabel,
  categoryMatchesFilter,
  isExpenseCategory,
  isIncomeCategory,
  prepareDraft,
} from "@/lib/transaction-utils";
import {
  CURRENCY_CODES,
  normalizeCurrency,
  readDefaultCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import type { Transaction, TransactionDraft, TransactionType } from "@/lib/types";
import { useI18n } from "@/components/LocaleProvider";
import type { MessageKey, TranslateFn } from "@/lib/i18n";
import {
  cleanNote,
  isRecurringNote,
  markRecurringTxSkipped,
  withPreservedRecTags,
} from "@/lib/utils";

const TYPE_SEGMENTS: { key: "ALL" | TransactionType; labelKey: MessageKey }[] = [
  { key: "ALL", labelKey: "transactions.filterAll" },
  { key: "EXPENSE", labelKey: "transactions.filterExpense" },
  { key: "INCOME", labelKey: "transactions.filterIncome" },
];

const FILTER_PILL_BASE =
  "flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-medium transition-all duration-150 active:scale-[0.98]";
const FILTER_PILL_IDLE =
  "border border-cream-border bg-cream-card/90 text-ink-muted shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F2EA]";
const FILTER_PILL_ACTIVE =
  "border border-ink bg-ink text-white shadow-[0_1px_2px_rgba(58,50,43,0.2)]";
const FILTER_ICON_IDLE = "size-3.5 shrink-0 text-ink-muted";
const FILTER_ICON_ACTIVE = "size-3.5 shrink-0 text-white";


function displayDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
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
  t: TranslateFn,
): string {
  const totals = dayTotalsByCurrency(items).filter(([, s]) => s.expense > 0);
  if (totals.length === 0) return "";
  totals.sort(([a], [b]) => {
    if (a === preferred) return -1;
    if (b === preferred) return 1;
    return a.localeCompare(b);
  });
  return totals
    .map(([code, sums]) =>
      t("transactions.dayExpense", { amount: formatMoney(sums.expense, code) }),
    )
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
  return `grid size-9 place-items-center rounded-full border transition-all duration-150 active:scale-[0.98] ${
    active
      ? "border-brand-primary/40 bg-[#FFF1E0] text-expense"
      : "border-cream-border bg-cream-card text-ink-body shadow-sm"
  }`;
}

export function TransactionsPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"ALL" | TransactionType>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  /** typeFilter=全部 时，分类面板展示支出还是收入 */
  const [categoryScope, setCategoryScope] = useState<"EXPENSE" | "INCOME">(
    "EXPENSE",
  );
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
      toast.error(t("toast.txOfflineRead"));
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
  }, [t]);

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
          : categoryScope === "EXPENSE"
            ? EXPENSE_CATEGORIES
            : INCOME_CATEGORIES;
    if (!(allowed as readonly string[]).includes(categoryFilter)) {
      setCategoryFilter("ALL");
    }
  }, [typeFilter, categoryScope, categoryFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((item) => {
      if (recurringOnly && !isRecurringNote(item.note)) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (!categoryMatchesFilter(item.category, categoryFilter)) return false;
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
        categoryLabel(item.category, t).toLowerCase().includes(q) ||
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
    t,
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
    return categoryScope === "EXPENSE"
      ? [...EXPENSE_CATEGORIES]
      : [...INCOME_CATEGORIES];
  }, [typeFilter, categoryScope]);

  const categorySectionTitle =
    typeFilter === "INCOME" ||
    (typeFilter === "ALL" && categoryScope === "INCOME")
      ? t("transactions.incomeCategories")
      : t("transactions.expenseCategories");

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
      toast.error(t("toast.txOfflineSave"));
      return;
    }
    setMutating(true);
    const isEditing = dialogMode === "edit";
    const toastId = toast.loading(
      isEditing ? t("toast.txUpdating") : t("toast.txCreating"),
    );
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
        if (!editingId) throw new Error(t("transactions.error.missingIdUpdate"));
        await updateTransactionDraft(editingId, cleanDraft);
      } else {
        await insertTransactionDraft(cleanDraft);
      }
      setDialogMode(null);
      toast.success(isEditing ? t("toast.txUpdated") : t("toast.txCreated"), { id: toastId });
      await loadTransactions();
    } catch (error) {
      toast.error(formatSupabaseError(error), { id: toastId });
    } finally {
      setMutating(false);
    }
  }

  async function deleteFromDialog() {
    if (!editingId) {
      toast.error(t("transactions.error.missingIdDelete"));
      return;
    }
    if (!navigator.onLine) {
      toast.error(t("toast.txOfflineDelete"));
      return;
    }

    const original = transactions.find((item) => item.id === editingId);
    const isRecurring = isRecurringNote(original?.note);

    if (
      !window.confirm(
        isRecurring
          ? t("transactions.confirm.skip", { name: cleanNote(draft.note) || draft.category })
          : t("transactions.confirm.delete", { name: cleanNote(draft.note) || draft.category }),
      )
    ) {
      return;
    }
    setDeleting(true);
    const toastId = toast.loading(
      isRecurring ? t("toast.txSkipping") : t("toast.txDeleting"),
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
        toast.success(t("toast.txSkipped"), { id: toastId });
      } else {
        const { error } = await getSupabase()
          .from("transactions")
          .delete()
          .eq("id", editingId);
        if (error) throw error;
        setTransactions((current) =>
          current.filter((item) => item.id !== editingId),
        );
        toast.success(t("toast.txDeleted"), { id: toastId });
      }
      setDialogMode(null);
      setEditingId(null);
      setEditingIsRecurring(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("toast.txOpFail"),
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
    setCategoryScope("EXPENSE");
  }

  function goManageRecurring() {
    setDialogMode(null);
    router.push("/summary");
  }

  return (
    <>
      <main className="relative flex h-full min-h-0 flex-col bg-cream-bg pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
        <header className="shrink-0 px-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-ink-muted">
                {t("transactions.eyebrow")}
              </p>
              <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight text-ink">
                {t("transactions.title")}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                aria-label={searchOpen ? t("transactions.aria.collapseSearch") : t("transactions.aria.expandSearch")}
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
                  <X className="size-4" strokeWidth={2} />
                ) : (
                  <Search className="size-4" strokeWidth={2} />
                )}
              </button>
              <button
                aria-label={t("transactions.aria.manualAdd")}
                className="grid size-9 place-items-center rounded-full bg-ink text-white shadow-sm transition-all duration-150 active:scale-[0.98]"
                onClick={openCreate}
                type="button"
              >
                <Plus className="size-5" strokeWidth={2.25} />
              </button>
            </div>
          </div>

          {searchOpen ? (
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-[#C0B49A]" strokeWidth={2} />
              <input
                autoFocus
                className="h-10 w-full rounded-2xl border border-cream-border bg-cream-card pl-10 pr-3 text-sm text-ink outline-none shadow-sm transition-all placeholder:text-ink-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("transactions.searchPlaceholder")}
                value={query}
              />
            </label>
          ) : null}

          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex min-w-0 flex-1 rounded-xl bg-[#EBE6DC] p-[3px]">
              {TYPE_SEGMENTS.map(({ key, labelKey }) => {
                const active = typeFilter === key;
                return (
                  <button
                    className={`h-8 flex-1 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] ${
                      active
                        ? "bg-cream-card text-ink shadow-sm"
                        : "text-ink-muted"
                    }`}
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    type="button"
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>

            <button
              aria-label={t("transactions.aria.moreFilters")}
              className={`flex h-9 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] ${
                filterActiveCount > 0
                  ? "border-cream-border bg-[#FFF6E8] text-expense"
                  : "border-cream-border bg-cream-card text-ink-body shadow-sm"
              }`}
              onClick={() => setFilterOpen(true)}
              type="button"
            >
              <Settings2 className="size-3.5" strokeWidth={2} />
              <span>{t("transactions.filter")}</span>
              {filterActiveCount > 0 ? (
                <span className="grid size-4 place-items-center rounded-full bg-expense text-[10px] font-bold text-white">
                  {filterActiveCount}
                </span>
              ) : (
                <ChevronDown className="size-3.5 opacity-50" strokeWidth={2} />
              )}
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 touch-pan-y">
          {loading && transactions.length === 0 ? (
            <TransactionListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-cream-border bg-cream-card/70 px-5 py-14 text-center">
              <p className="font-medium text-ink-title">{t("transactions.emptyTitle")}</p>
              <p className="mt-1 text-sm text-[#9A8B78]">
                {recurringOnly
                  ? t("transactions.empty.recurringHint")
                  : t("transactions.empty.genericHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {Object.entries(grouped).map(([date, items]) => {
                const dayExpense = formatDayExpenseSummary(
                  items,
                  defaultCurrency,
                  t,
                );
                return (
                  <section key={date}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                      <h2 className="font-medium text-ink-body">
                        {displayDate(date, locale)}
                      </h2>
                      {dayExpense ? (
                        <p className="truncate font-numeric text-[12px] font-medium text-ink-muted">
                          {dayExpense}
                        </p>
                      ) : null}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-cream-border bg-cream-card shadow-sm divide-y divide-cream-border">
                      {items.map((item, index) => {
                        const expense = item.type === "EXPENSE";
                        const recurring = isRecurringNote(item.note);
                        const currency = normalizeCurrency(item.currency);
                        const showCurrencyChip = currency !== defaultCurrency;
                        const note = cleanNote(item.note) || item.category;
                        const tone = categoryIconTone(item.category);

                        return (
                          <button
                            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-all duration-150 active:scale-[0.98] active:bg-cream-bg/80"
                            key={item.id ?? `${date}-${index}`}
                            onClick={() => openEdit(item)}
                            type="button"
                          >
                            <div
                              className="grid size-10 shrink-0 place-items-center rounded-xl"
                              style={tone}
                            >
                              <CategoryIcon
                                category={item.category}
                                className="size-4"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-ink">
                                {categoryLabel(item.category, t)}
                              </p>
                              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink-muted">
                                <span className="truncate">{note}</span>
                                {recurring ? (
                                  <span
                                    aria-label={t("transactions.aria.recurringBill")}
                                    className="inline-flex shrink-0 items-center rounded-full bg-brand-primary/10 px-1 py-px text-brand-primary"
                                    title={t("transactions.aria.recurringBill")}
                                  >
                                    <RecurringBadgeIcon className="size-3.5" />
                                  </span>
                                ) : null}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              {showCurrencyChip ? (
                                <span className="rounded-full bg-cream-bg px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-muted">
                                  {currency}
                                </span>
                              ) : null}
                              <p
                                className={`font-numeric text-sm font-semibold ${
                                  expense ? "text-expense" : "text-income"
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
        contentClassName="max-h-[80vh] overflow-y-auto overscroll-contain scrollbar-none px-6 py-5 space-y-6 touch-pan-y pb-[calc(env(safe-area-inset-bottom)+20px)]"
        header={
          <div className="flex items-center justify-between border-b border-cream-border px-6 py-4">
            <button
              className="min-w-[3.25rem] text-left text-[15px] font-normal text-ink-muted transition-opacity active:opacity-60"
              onClick={resetFilters}
              type="button"
            >
              {t("transactions.filterReset")}
            </button>
            <p className="text-base font-semibold text-ink-body">{t("transactions.filter")}</p>
            <button
              className="rounded-full bg-ink-body px-4 py-1.5 text-xs font-medium text-white shadow-[0_1px_2px_rgba(74,62,49,0.18)] transition-opacity active:opacity-80"
              onClick={() => setFilterOpen(false)}
              type="button"
            >
              {t("transactions.filterDone")}
            </button>
          </div>
        }
        onOpenChange={setFilterOpen}
        open={filterOpen}
        title={t("transactions.filter")}
      >
        <section>
          <p className="mb-3 text-xs font-medium text-ink-muted">{t("transactions.selectCurrency")}</p>
          <div className="grid grid-cols-5 gap-2">
            {(["ALL", ...CURRENCY_CODES] as const).map((key) => {
              const active = currencyFilter === key;
              return (
                <button
                  className={`${FILTER_PILL_BASE} ${
                    active ? FILTER_PILL_ACTIVE : FILTER_PILL_IDLE
                  }`}
                  key={key}
                  onClick={() => setCurrencyFilter(key)}
                  type="button"
                >
                  {key === "ALL" ? t("common.all") : key}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#8C8273]">
              {categorySectionTitle}
            </p>
            {typeFilter === "ALL" ? (
              <div className="flex rounded-xl bg-[#EFE8DC] p-0.5">
                {(
                  [
                    { key: "EXPENSE" as const, label: t("transactions.expenseCategories") },
                    { key: "INCOME" as const, label: t("transactions.incomeCategories") },
                  ] as const
                ).map((tab) => {
                  const active = categoryScope === tab.key;
                  return (
                    <button
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? "bg-cream-card text-ink-body shadow-sm"
                          : "text-ink-muted"
                      }`}
                      key={tab.key}
                      onClick={() => {
                        setCategoryScope(tab.key);
                        if (
                          categoryFilter !== "ALL" &&
                          (tab.key === "EXPENSE"
                            ? !isExpenseCategory(categoryFilter)
                            : !isIncomeCategory(categoryFilter))
                        ) {
                          setCategoryFilter("ALL");
                        }
                      }}
                      type="button"
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              className={`${FILTER_PILL_BASE} ${
                categoryFilter === "ALL" ? FILTER_PILL_ACTIVE : FILTER_PILL_IDLE
              }`}
              onClick={() => setCategoryFilter("ALL")}
              type="button"
            >
              <LayoutGrid
                className={
                  categoryFilter === "ALL"
                    ? FILTER_ICON_ACTIVE
                    : FILTER_ICON_IDLE
                }
                strokeWidth={2}
              />
              <span>{t("common.all")}</span>
            </button>
            {categoryOptions.map((category) => {
              const active = categoryFilter === category;
              return (
                <button
                  className={`${FILTER_PILL_BASE} ${
                    active ? FILTER_PILL_ACTIVE : FILTER_PILL_IDLE
                  }`}
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  type="button"
                >
                  <CategoryIcon
                    category={category}
                    className={active ? FILTER_ICON_ACTIVE : FILTER_ICON_IDLE}
                  />
                  <span>{categoryLabel(category, t)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between rounded-2xl border border-cream-border bg-cream-card/80 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-body">
              <RecurringBadgeIcon className="size-3.5 text-brand-primary" />
              {t("transactions.recurringOnly")}
            </p>
            <button
              aria-checked={recurringOnly}
              aria-label={t("transactions.recurringOnly")}
              className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
                recurringOnly ? "bg-brand-primary" : "bg-[#E5DDD0]"
              }`}
              onClick={() => setRecurringOnly((v) => !v)}
              role="switch"
              type="button"
            >
              <span
                className={`absolute top-[2px] size-[27px] rounded-full bg-cream-card shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-transform duration-200 ${
                  recurringOnly ? "translate-x-[22px]" : "translate-x-[2px]"
                }`}
              />
            </button>
          </div>
        </section>
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
        submitLabel={dialogMode === "edit" ? t("transactions.dialog.save") : t("transactions.dialog.add")}
        title={dialogMode === "edit" ? t("transactions.dialog.editTitle") : t("transactions.dialog.addTitle")}
        value={draft}
      />
    </>
  );
}
