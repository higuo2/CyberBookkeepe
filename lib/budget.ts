import { getMonthRange } from "@/lib/transaction-utils";
import type { MonthBudgetStats } from "@/lib/types";
import type { BudgetSpendMode } from "@/lib/planner";

export function computeBudgetStats(
  budget: number,
  spent: number,
  date = new Date(),
  options?: {
    estimatedFixed?: number;
    spendMode?: BudgetSpendMode;
  },
): MonthBudgetStats {
  const { remainingDays } = getMonthRange(date);
  const estimatedFixed = Math.max(0, options?.estimatedFixed ?? 0);
  const spendMode = options?.spendMode ?? "actual";
  const committed =
    spendMode === "reserve_fixed" ? spent + estimatedFixed : spent;
  const remaining = budget - committed;
  return {
    budget,
    spent,
    remaining,
    dailyAvailable: remainingDays > 0 ? remaining / remainingDays : remaining,
    ratio: budget > 0 ? committed / budget : 0,
    estimatedFixed,
    spendMode,
    committed,
  };
}

export function budgetBarColor(ratio: number) {
  if (ratio > 1) return "bg-[#EF4444]";
  if (ratio >= 0.8) return "bg-[#F97316]";
  return "bg-[#F8A055]";
}
