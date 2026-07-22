import {
  inferRecurringCategory,
  occurrenceDateInMonth,
  readRecurringItems,
  type RecurringItem,
} from "@/lib/planner";
import { getSupabase } from "@/lib/supabase";
import {
  formatHKD,
  getMonthRange,
  localDateString,
} from "@/lib/transaction-utils";
import type { Transaction, TransactionDraft } from "@/lib/types";

const JS_DAY_TO_CODE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/**
 * Tag 粒度：
 * - monthly / yearly → `#rec:{id}:{yyyy-mm}`
 * - by_days（工作日/按日）→ `#rec:{id}:{yyyy-mm-dd}`
 */
export function periodKeyForItem(
  item: RecurringItem,
  date = new Date(),
): string {
  if (item.recurrence.kind === "by_days") {
    return localDateString(date);
  }
  return localDateString(date).slice(0, 7);
}

export function loggedKey(itemId: string, periodKey: string) {
  return `${itemId}:${periodKey}`;
}

/** note 中的自动记账标记：#rec:{itemId}:{periodKey} */
export function recurringMarker(itemId: string, periodKey: string) {
  return `#rec:${itemId}:${periodKey}`;
}

export function buildAutoNote(item: RecurringItem, periodKey: string) {
  return `${item.name} ${recurringMarker(item.id, periodKey)}`.trim();
}

export function monthPeriodKey(date = new Date()) {
  return localDateString(date).slice(0, 7);
}

export function extractLoggedKeys(transactions: Transaction[]): Set<string> {
  const keys = new Set<string>();
  for (const tx of transactions) {
    const match = tx.note?.match(/#rec:([^:\s]+):([0-9-]+)/);
    if (match) keys.add(`${match[1]}:${match[2]}`);
  }
  return keys;
}

export function isItemLoggedThisMonth(
  item: RecurringItem,
  loggedKeys: Set<string>,
  date = new Date(),
) {
  if (item.recurrence.kind === "by_days") {
    // 日粒度：仅看「今天」是否已记
    return loggedKeys.has(loggedKey(item.id, localDateString(date)));
  }
  return loggedKeys.has(loggedKey(item.id, periodKeyForItem(item, date)));
}

export type RecurringCardStatus =
  | { kind: "logged" }
  | { kind: "upcoming"; days: number }
  | { kind: "due_pending" };

export function getRecurringCardStatus(
  item: RecurringItem,
  loggedKeys: Set<string>,
  date = new Date(),
): RecurringCardStatus {
  const today = localDateString(date);

  if (item.recurrence.kind === "by_days") {
    const todayKey = loggedKey(item.id, today);
    if (loggedKeys.has(todayKey)) return { kind: "logged" };

    const days = item.recurrence.by_days ?? [];
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(date);
      d.setDate(date.getDate() + i);
      const ds = localDateString(d);
      const code = JS_DAY_TO_CODE[d.getDay()];
      if (!days.includes(code)) continue;
      const key = loggedKey(item.id, ds);
      if (!loggedKeys.has(key)) {
        if (i === 0) return { kind: "due_pending" };
        return { kind: "upcoming", days: i };
      }
    }
    return { kind: "logged" };
  }

  const occ = occurrenceDateInMonth(item, date);
  if (!occ) return { kind: "upcoming", days: 30 };
  const key = loggedKey(item.id, periodKeyForItem(item, date));
  if (loggedKeys.has(key)) return { kind: "logged" };
  if (occ > today) {
    const days = Math.ceil(
      (new Date(`${occ}T00:00:00`).getTime() -
        new Date(`${today}T00:00:00`).getTime()) /
        86_400_000,
    );
    return { kind: "upcoming", days };
  }
  return { kind: "due_pending" };
}

export function buildRecurringDraft(
  item: RecurringItem,
  date: string,
  periodKey: string,
): TransactionDraft & { auto_generated: true } {
  return {
    amount: item.amount,
    type: item.direction === "income" ? "INCOME" : "EXPENSE",
    category: inferRecurringCategory(item),
    date,
    note: buildAutoNote(item, periodKey),
    auto_generated: true,
  };
}

function draftsDueForItem(
  item: RecurringItem,
  loggedKeys: Set<string>,
  now: Date,
): { draft: TransactionDraft; periodKey: string }[] {
  if (item.autoWrite === false) return [];
  const today = localDateString(now);
  const endDate = item.recurrence.end_date ?? null;
  if (endDate && endDate < today) return [];

  const results: { draft: TransactionDraft; periodKey: string }[] = [];

  if (item.recurrence.kind === "by_days") {
    const days = item.recurrence.by_days ?? [];
    const code = JS_DAY_TO_CODE[now.getDay()];
    const periodKey = periodKeyForItem(item, now); // yyyy-mm-dd
    const key = loggedKey(item.id, periodKey);
    if (
      days.includes(code) &&
      (!endDate || today <= endDate) &&
      !loggedKeys.has(key)
    ) {
      results.push({
        draft: buildRecurringDraft(item, today, periodKey),
        periodKey,
      });
    }
    return results;
  }

  const occ = occurrenceDateInMonth(item, now);
  if (!occ || occ > today) return [];
  const periodKey = periodKeyForItem(item, now); // yyyy-mm
  const key = loggedKey(item.id, periodKey);
  if (loggedKeys.has(key)) return [];

  results.push({
    draft: buildRecurringDraft(item, occ, periodKey),
    periodKey,
  });
  return results;
}

/**
 * 「提前记一笔」草稿：备注必带对应粒度的 #rec 标签，
 * 避免到期日再次自动写入。
 */
export function buildEarlyWriteDraft(
  item: RecurringItem,
  now = new Date(),
): { draft: TransactionDraft; periodKey: string } | null {
  const today = localDateString(now);

  if (item.recurrence.kind === "by_days") {
    const periodKey = periodKeyForItem(item, now); // yyyy-mm-dd
    return {
      draft: buildRecurringDraft(item, today, periodKey),
      periodKey,
    };
  }

  const occ = occurrenceDateInMonth(item, now);
  const periodKey = periodKeyForItem(item, now); // yyyy-mm
  const date = occ && occ <= today ? occ : today;
  return {
    draft: buildRecurringDraft(item, date, periodKey),
    periodKey,
  };
}

export async function fetchMonthTransactions(now = new Date()) {
  const { firstDay, lastDay } = getMonthRange(now);
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("id, amount, type, category, date, note")
    .gte("date", firstDay)
    .lte("date", lastDay);
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function insertTransactionDraft(draft: TransactionDraft) {
  const { auto_generated: _auto, ...row } = draft as TransactionDraft & {
    auto_generated?: boolean;
  };
  void _auto;
  const { data, error } = await getSupabase()
    .from("transactions")
    .insert(row)
    .select("id, amount, type, category, date, note")
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function updateTransactionDraft(
  id: string,
  draft: TransactionDraft,
) {
  const { auto_generated: _auto, ...row } = draft as TransactionDraft & {
    auto_generated?: boolean;
  };
  void _auto;
  const { data, error } = await getSupabase()
    .from("transactions")
    .update(row)
    .eq("id", id)
    .select("id, amount, type, category, date, note")
    .single();
  if (error) throw error;
  return data as Transaction;
}

export function transactionsForRecurringItem(
  transactions: Transaction[],
  itemId: string,
) {
  const prefix = `#rec:${itemId}:`;
  return transactions.filter((tx) => tx.note?.includes(prefix));
}

/**
 * 周期项修改后：同步更新本月已关联的自动账单；
 * 若当前周期尚未记账且已到期（且开启自动记账），则补记一笔。
 */
export async function reconcileRecurringItemLedger(
  item: RecurringItem,
  now = new Date(),
): Promise<{ updated: number; created: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { updated: 0, created: 0 };
  }

  const monthTx = await fetchMonthTransactions(now);
  const matches = transactionsForRecurringItem(monthTx, item.id);
  let updated = 0;

  for (const tx of matches) {
    if (!tx.id) continue;
    const m = tx.note?.match(/#rec:[^:\s]+:([0-9-]+)/);
    const periodKey = m?.[1] ?? periodKeyForItem(item, now);
    let date = tx.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) {
      date = periodKey;
    } else {
      const occ = occurrenceDateInMonth(item, now);
      if (occ) date = occ;
    }
    try {
      await updateTransactionDraft(
        tx.id,
        buildRecurringDraft(item, date, periodKey),
      );
      updated += 1;
    } catch {
      // 单条失败不阻断
    }
  }

  const createdRows = await syncDueRecurringItems([item], now);
  return { updated, created: createdRows.length };
}

export type AutoSyncCreated = {
  name: string;
  amount: number;
  direction: RecurringItem["direction"];
};

/**
 * 检查并自动写入已到期、尚未记入的周期项。
 */
export async function syncDueRecurringItems(
  items?: RecurringItem[],
  now = new Date(),
): Promise<AutoSyncCreated[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return [];
  const list = items ?? readRecurringItems();
  const monthTx = await fetchMonthTransactions(now);
  const loggedKeys = extractLoggedKeys(monthTx);
  const created: AutoSyncCreated[] = [];

  for (const item of list) {
    const due = draftsDueForItem(item, loggedKeys, now);
    for (const entry of due) {
      const key = loggedKey(item.id, entry.periodKey);
      if (loggedKeys.has(key)) continue;
      try {
        await insertTransactionDraft(entry.draft);
        loggedKeys.add(key);
        created.push({
          name: item.name,
          amount: item.amount,
          direction: item.direction,
        });
      } catch {
        // 单条失败不阻断其余
      }
    }
  }

  return created;
}

/** 单笔 / 多笔合并 toast 文案 */
export function formatAutoSyncToast(created: AutoSyncCreated[]) {
  if (created.length === 0) return null;
  if (created.length === 1) {
    const row = created[0];
    return `已为你自动记入本月${row.name} ${formatHKD(row.amount)}~`;
  }
  return `已为你自动记入 ${created.length} 笔到期固定收支~`;
}
