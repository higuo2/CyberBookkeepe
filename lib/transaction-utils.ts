import type { Transaction, TransactionDraft, TransactionType } from "@/lib/types";
import type { MessageKey, TranslateFn } from "@/lib/i18n";
import {
  DEFAULT_CURRENCY,
  formatMoney,
  normalizeCurrency,
  ZERO_DECIMAL_CURRENCIES,
  type CurrencyCode,
} from "@/lib/currency";

export const EXPENSE_CATEGORIES = [
  "餐饮",
  "交通",
  "购物",
  "娱乐",
  "住房",
  "数码",
  "医疗",
  "宠物",
  "学习",
  "丽人",
  "其它支出",
] as const;

export const INCOME_CATEGORIES = [
  "工资",
  "兼职",
  "理财",
  "奖金",
  "其它收入",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

/** @deprecated use EXPENSE_CATEGORIES / INCOME_CATEGORIES */
export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const;

/** 旧名 → 规范名（居住→住房；裸「其它」默认其它支出，收入场景请显式传其它收入） */
export function canonicalizeCategory(category: string): string {
  const raw = category.trim();
  if (!raw) return raw;
  if (raw === "居住" || raw === "住房") return "住房";
  if (raw === "其它支出" || raw === "其他支出") return "其它支出";
  if (raw === "其它收入" || raw === "其他收入") return "其它收入";
  if (raw === "其它" || raw === "其他") return "其它支出";
  return raw;
}

/** 筛选/列表短名：其它支出、其它收入 →「其它」 */
export function categoryLabel(category: string, t?: TranslateFn): string {
  const name = canonicalizeCategory(category);
  if (name === "其它支出" || name === "其它收入") {
    return t ? t("common.otherShort") : "其它";
  }
  if (t) return t(`category.${name}` as MessageKey);
  return name;
}

/** 筛选：规范名相等，并兼容旧库「居住 / 其它」 */
export function categoryMatchesFilter(
  itemCategory: string,
  filterCategory: string,
): boolean {
  if (filterCategory === "ALL") return true;
  return (
    canonicalizeCategory(itemCategory) === canonicalizeCategory(filterCategory)
  );
}

export function isExpenseCategory(category: string): boolean {
  const name = canonicalizeCategory(category);
  return (EXPENSE_CATEGORIES as readonly string[]).includes(name);
}

export function isIncomeCategory(category: string): boolean {
  const name = canonicalizeCategory(category);
  return (INCOME_CATEGORIES as readonly string[]).includes(name);
}

export const BUDGET_STORAGE_KEY = "cyberbookkeeper_monthly_budget";

/** @deprecated 请用 formatMoney(amount, currency)；保留作港币预算等场景 */
export function formatHKD(amount: number) {
  return formatMoney(amount, "HKD");
}

export { formatMoney, normalizeCurrency };
export type { CurrencyCode };

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
  currency: CurrencyCode = DEFAULT_CURRENCY,
): TransactionDraft {
  return {
    amount: 0,
    type,
    category: defaultCategory(type),
    date: localDateString(),
    note: "",
    currency,
  };
}

/** Note is optional — empty note becomes category name before save. */
export function prepareDraft(draft: TransactionDraft): TransactionDraft {
  const category =
    canonicalizeCategory(draft.category.trim()) ||
    defaultCategory(draft.type);
  const currency = normalizeCurrency(draft.currency);
  let amount = Number(draft.amount);
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
    amount = Math.round(amount);
  }
  return {
    ...draft,
    amount,
    category,
    note: draft.note.trim() || category,
    currency,
  };
}

export function validateDraft(draft: TransactionDraft): MessageKey | null {
  if (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) {
    return "errors.amountPositive";
  }
  if (!draft.category.trim()) return "errors.selectCategory";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "errors.validDate";
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

/** 将查询行规范为带 currency 的 Transaction */
export function hydrateTransaction(
  row: Record<string, unknown>,
): Transaction {
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    amount: Number(row.amount),
    type: row.type === "INCOME" ? "INCOME" : "EXPENSE",
    category: canonicalizeCategory(String(row.category ?? "")),
    date: String(row.date ?? ""),
    note: String(row.note ?? ""),
    currency: normalizeCurrency(row.currency),
  };
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
