import {
  WORKDAYS,
  createRecurringItem,
  nextByDaysDate,
  nextMonthlyDate,
  readRecurringItems,
  writeRecurringItems,
  type RecurringItem,
  type WeekdayCode,
} from "@/lib/planner";
import type { ParsedRecurringData } from "@/lib/types";

/** AI by_days：1=周一 … 7=周日 → 内部 WeekdayCode */
const AI_DAY_TO_CODE: Record<number, WeekdayCode> = {
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
  7: "SUN",
};

export function mapAiDaysToCodes(days?: number[]): WeekdayCode[] {
  if (!days?.length) return [...WORKDAYS];
  const codes = days
    .map((n) => AI_DAY_TO_CODE[n])
    .filter((c): c is WeekdayCode => Boolean(c));
  return codes.length > 0 ? codes : [...WORKDAYS];
}

/** 将 AI 周期解析结果转为规划页 RecurringItem */
export function recurringItemFromAiParse(
  data: ParsedRecurringData,
): RecurringItem {
  const direction = data.direction === "income" ? "income" : "expense";
  const endDate =
    data.end_date && /^\d{4}-\d{2}-\d{2}$/.test(data.end_date)
      ? data.end_date
      : null;

  if (data.period_type === "monthly") {
    const dayOfMonth = Math.min(
      31,
      Math.max(1, Number(data.day_of_month) || 1),
    );
    return createRecurringItem({
      name: data.title,
      amount: data.amount,
      direction,
      category: data.category,
      autoWrite: data.auto_record !== false,
      recurrence: {
        kind: "monthly",
        dayOfMonth,
        end_date: endDate,
      },
      nextDate: nextMonthlyDate(dayOfMonth),
      emoji: direction === "income" ? "💵" : "☁️",
    });
  }

  const byDays =
    data.period_type === "daily"
      ? (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as WeekdayCode[])
      : mapAiDaysToCodes(data.by_days);

  return createRecurringItem({
    name: data.title,
    amount: data.amount,
    direction,
    category: data.category,
    autoWrite: data.auto_record !== false,
    recurrence: {
      kind: "by_days",
      by_days: byDays,
      end_date: endDate,
    },
    nextDate: nextByDaysDate(byDays),
    emoji: direction === "income" ? "💵" : "🚌",
  });
}

/** 写入本地周期列表（插到最前），返回新建项 */
export function persistAiRecurringItem(data: ParsedRecurringData): RecurringItem {
  const item = recurringItemFromAiParse(data);
  const next = [item, ...readRecurringItems()];
  writeRecurringItems(next);
  return item;
}
