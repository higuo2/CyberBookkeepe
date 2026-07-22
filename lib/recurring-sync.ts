import {
  inferRecurringCategory,
  isLegacyDemoRecurringItem,
  LEGACY_DEMO_RECURRING_IDS,
  occurrenceDateInMonth,
  readRecurringItems,
  type RecurringItem,
  type WeekdayCode,
} from "@/lib/planner";
import { getSupabase } from "@/lib/supabase";
import {
  formatHKD,
  getMonthRange,
  localDateString,
} from "@/lib/transaction-utils";
import type { Transaction, TransactionDraft } from "@/lib/types";
import { isActiveTransaction } from "@/lib/utils";

const JS_DAY_TO_CODE: WeekdayCode[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

const DEMO_TX_PURGED_KEY = "cyberbookkeeper_demo_rec_tx_purged_v1";

/** 防抖并发锁：避免多入口同时 sync 重复入账 */
let isSyncing = false;

/** 删除云端由演示周期项自动写入的账单（#rec:sub-netflix 等） */
export async function purgeLegacyDemoRecurringTransactions(): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  if (localStorage.getItem(DEMO_TX_PURGED_KEY) === "1") return 0;

  const { data, error } = await getSupabase()
    .from("transactions")
    .select("id, note");
  if (error) throw error;

  const ids = (data ?? [])
    .filter((row) => {
      const note = String((row as Transaction).note ?? "");
      const match = note.match(/#rec:([^:\s]+):/);
      return match ? LEGACY_DEMO_RECURRING_IDS.has(match[1]) : false;
    })
    .map((row) => (row as Transaction).id)
    .filter((id): id is string => Boolean(id));

  if (ids.length > 0) {
    const { error: delError } = await getSupabase()
      .from("transactions")
      .delete()
      .in("id", ids);
    if (delError) throw delError;
  }

  localStorage.setItem(DEMO_TX_PURGED_KEY, "1");
  return ids.length;
}

/**
 * Tag 粒度（时光机引擎统一为日）：`#rec:{id}:{yyyy-mm-dd}`
 * 兼容读取旧版 `#rec:{id}:{yyyy-mm}`。
 */
export function periodKeyForItem(
  item: RecurringItem,
  date = new Date(),
): string {
  if (item.recurrence.kind === "by_days") {
    return localDateString(date);
  }
  const occ = occurrenceDateInMonth(item, date);
  return occ ?? localDateString(date);
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
    return loggedKeys.has(loggedKey(item.id, localDateString(date)));
  }
  const occ = occurrenceDateInMonth(item, date);
  if (!occ) return false;
  return (
    loggedKeys.has(loggedKey(item.id, occ)) ||
    loggedKeys.has(loggedKey(item.id, occ.slice(0, 7)))
  );
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
  if (
    loggedKeys.has(loggedKey(item.id, occ)) ||
    loggedKeys.has(loggedKey(item.id, occ.slice(0, 7)))
  ) {
    return { kind: "logged" };
  }
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

/** 该 cursor 日是否命中周期规律 */
export function matchesRecurrenceOnDate(
  item: RecurringItem,
  cursor: Date,
): boolean {
  const cursorDate = localDateString(cursor);
  const endDate = item.recurrence.end_date ?? null;
  if (endDate && cursorDate > endDate) return false;

  if (item.recurrence.kind === "by_days") {
    const days = item.recurrence.by_days ?? [];
    return days.includes(JS_DAY_TO_CODE[cursor.getDay()]);
  }

  if (item.recurrence.kind === "yearly") {
    const month = Number(item.nextDate.slice(5, 7)) - 1;
    if (cursor.getMonth() !== month) return false;
  }

  const day =
    item.recurrence.dayOfMonth ??
    Number(item.nextDate.slice(8, 10)) ??
    cursor.getDate();
  const dim = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();
  const targetDay = Math.min(Math.max(1, day), dim);
  return cursor.getDate() === targetDay;
}

/** effective_start = max(start_date, created_at 的日期部分) */
export function effectiveStartDate(item: RecurringItem, today: string): string {
  const candidates: string[] = [];
  if (item.startDate && /^\d{4}-\d{2}-\d{2}$/.test(item.startDate)) {
    candidates.push(item.startDate);
  }
  if (item.createdAt) {
    const d = item.createdAt.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) candidates.push(d);
  }
  if (candidates.length === 0) return today;
  return candidates.reduce((a, b) => (a > b ? a : b));
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
    const periodKey = today;
    return {
      draft: buildRecurringDraft(item, today, periodKey),
      periodKey,
    };
  }

  const occ = occurrenceDateInMonth(item, now);
  const periodKey = occ && occ <= today ? occ : today;
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
  // 含「已跳过」：#rec 去重仍生效；展示/统计请再用 filterActiveTransactions
  return (data ?? []) as Transaction[];
}

async function fetchTransactionsInRange(fromDate: string, toDate: string) {
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("id, amount, type, category, date, note")
    .gte("date", fromDate)
    .lte("date", toDate);
  if (error) throw error;
  // 含已跳过：用于 #rec 去重；返回全部
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

/** 按 AI 消息幂等标记查找已写入账单 */
export async function findTransactionByMsgMarker(
  marker: string,
): Promise<Transaction | null> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("id, amount, type, category, date, note")
    .ilike("note", `%${marker}%`)
    .limit(5);
  if (error) throw error;
  const rows = (data ?? []) as Transaction[];
  return (
    rows.find((row) => row.note?.includes(marker) && isActiveTransaction(row)) ??
    rows.find((row) => row.note?.includes(marker)) ??
    null
  );
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
 * 规则修改后：仅补记到期项，绝不回溯覆盖已生成账单。
 */
export async function reconcileRecurringItemLedger(
  item: RecurringItem,
  now = new Date(),
): Promise<{ updated: number; created: number }> {
  const createdRows = await syncDueRecurringItems([item], now);
  return { updated: 0, created: createdRows.length };
}

export type AutoSyncCreated = {
  name: string;
  amount: number;
  direction: RecurringItem["direction"];
};

/**
 * 时光机追溯同步：从 effective_start 逐日扫到今天，补记缺失的 #rec 账单。
 * 带全局并发锁，避免重复入账。
 */
export async function syncDueRecurringItems(
  items?: RecurringItem[],
  now = new Date(),
): Promise<AutoSyncCreated[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return [];
  if (isSyncing) return [];

  isSyncing = true;
  try {
    const list = (items ?? readRecurringItems()).filter(
      (item) => !isLegacyDemoRecurringItem(item) && item.autoWrite !== false,
    );
    if (list.length === 0) return [];

    const today = localDateString(now);
    let rangeStart = today;
    for (const item of list) {
      const start = effectiveStartDate(item, today);
      if (start < rangeStart) rangeStart = start;
    }

    const existing = await fetchTransactionsInRange(rangeStart, today);
    const loggedKeys = extractLoggedKeys(existing);
    const batch: TransactionDraft[] = [];
    const createdMeta: AutoSyncCreated[] = [];

    for (const item of list) {
      const endDate = item.recurrence.end_date ?? null;
      if (endDate && endDate < effectiveStartDate(item, today)) continue;

      const start = effectiveStartDate(item, today);
      const cursor = new Date(`${start}T00:00:00`);
      const last = new Date(`${today}T00:00:00`);

      while (cursor <= last) {
        const cursorDate = localDateString(cursor);
        if (endDate && cursorDate > endDate) break;

        if (matchesRecurrenceOnDate(item, cursor)) {
          const periodKey = cursorDate;
          const key = loggedKey(item.id, periodKey);
          const legacyMonthKey = loggedKey(item.id, cursorDate.slice(0, 7));
          const already =
            loggedKeys.has(key) ||
            (item.recurrence.kind !== "by_days" &&
              loggedKeys.has(legacyMonthKey));

          if (!already) {
            const draft = buildRecurringDraft(item, cursorDate, periodKey);
            batch.push(draft);
            loggedKeys.add(key);
            createdMeta.push({
              name: item.name,
              amount: item.amount,
              direction: item.direction,
            });
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const draft of batch) {
      try {
        await insertTransactionDraft(draft);
      } catch {
        // 单条失败不阻断其余
      }
    }

    return createdMeta;
  } finally {
    isSyncing = false;
  }
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
