import { getMonthRange } from "@/lib/transaction-utils";
import type { MonthBudgetStats } from "@/lib/types";

export function computeBudgetStats(
  budget: number,
  spent: number,
  date = new Date(),
): MonthBudgetStats {
  const { remainingDays } = getMonthRange(date);
  const remaining = budget - spent;
  return {
    budget,
    spent,
    remaining,
    dailyAvailable: remainingDays > 0 ? remaining / remainingDays : remaining,
    ratio: budget > 0 ? spent / budget : 0,
  };
}

export function budgetBarColor(ratio: number) {
  if (ratio > 1) return "bg-[#EF4444]";
  if (ratio >= 0.8) return "bg-[#F97316]";
  return "bg-[#F8A055]";
}
