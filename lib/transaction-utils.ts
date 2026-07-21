import type { Transaction, TransactionDraft, TransactionType } from "@/lib/types";

export const EXPENSE_CATEGORIES = [
  "餐饮",
  "交通",
  "购物",
  "娱乐",
  "居住",
  "数码",
  "医疗",
  "其它",
] as const;

export const INCOME_CATEGORIES = [
  "工资",
  "理财",
  "兼职",
  "其它收入",
] as const;

/** @deprecated use EXPENSE_CATEGORIES / INCOME_CATEGORIES */
export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const;

export const BUDGET_STORAGE_KEY = "cyberbookkeeper_monthly_budget";

export function formatHKD(amount: number) {
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    currencyDisplay: "narrowSymbol",
  }).format(Number(amount) || 0);
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function categoriesForType(type: TransactionType) {
  return type === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

export function defaultCategory(type: TransactionType) {
  return type === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
}

export function createEmptyTransaction(
  type: TransactionType = "EXPENSE",
): TransactionDraft {
  return {
    amount: 0,
    type,
    category: defaultCategory(type),
    date: localDateString(),
    note: "",
  };
}

/** Note is optional — empty note becomes category name before save. */
export function prepareDraft(draft: TransactionDraft): TransactionDraft {
  const category = draft.category.trim() || defaultCategory(draft.type);
  return {
    ...draft,
    amount: Number(draft.amount),
    category,
    note: draft.note.trim() || category,
  };
}

export function validateDraft(draft: TransactionDraft) {
  if (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) {
    return "请输入大于 0 的金额";
  }
  if (!draft.category.trim()) return "请选择分类";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "请选择有效日期";
  return null;
}

export function getMonthRange(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    firstDay: localDateString(first),
    lastDay: localDateString(last),
    daysInMonth: last.getDate(),
    dayOfMonth: date.getDate(),
    remainingDays: Math.max(1, last.getDate() - date.getDate() + 1),
  };
}

export function lastNDays(n: number, end = new Date()) {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    days.push(localDateString(d));
  }
  return days;
}

export function sumByCategory(items: Transaction[]) {
  const map = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + Number(item.amount);
    return acc;
  }, {});
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function readBudgetFromStorage() {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function writeBudgetToStorage(amount: number) {
  localStorage.setItem(BUDGET_STORAGE_KEY, String(Math.max(0, amount)));
}
