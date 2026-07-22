import { formatHKD, getMonthRange, localDateString } from "@/lib/transaction-utils";
import type { CurrencyCode } from "@/lib/currency";
import { DEFAULT_CURRENCY, normalizeCurrency } from "@/lib/currency";

export type PlannerAccount = {
  id: string;
  name: string;
  emoji: string;
  balance: number;
  note: string;
};

export type AccountLedgerEntry = {
  id: string;
  accountId: string;
  amount: number;
  note: string;
  date: string;
  createdAt: string;
};

export type WishlistGoal = {
  id: string;
  title: string;
  emoji: string;
  target: number;
  saved: number;
};

/** 周期方向：固定收入 / 固定支出 */
export type RecurringDirection = "income" | "expense";

/** 星期代码（自然语言 / API 统一用英文缩写） */
export type WeekdayCode =
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT"
  | "SUN";

export type RecurrenceKind = "monthly" | "yearly" | "by_days";

/** 周期规则 */
export type RecurrenceRule = {
  kind: RecurrenceKind;
  /** 每月 / 每年：几号扣款或入账（1–31） */
  dayOfMonth?: number;
  /** 按星期重复，如工作日 ['MON','TUE','WED','THU','FRI'] */
  by_days?: WeekdayCode[];
  /** 截止日期 YYYY-MM-DD；null/省略表示长期 */
  end_date?: string | null;
};

/** 周期收支条目（模块二） */
export type RecurringItem = {
  id: string;
  name: string;
  amount: number;
  direction: RecurringDirection;
  recurrence: RecurrenceRule;
  /** 下次发生日 YYYY-MM-DD（monthly/yearly 用；by_days 可为下次匹配日） */
  nextDate: string;
  remindDays: number;
  /** 到期后是否自动写入主账单，默认 true */
  autoWrite: boolean;
  /** 写入账单时的分类；缺省时按名称推断 */
  category?: string;
  /** 列表 / 表单展示用图标 */
  emoji?: string;
  /** 原生币种；缺省 HKD */
  currency?: CurrencyCode;
  /** 规则生效起始日 YYYY-MM-DD（追溯同步起点） */
  startDate?: string;
  /** 创建时间 ISO；与 startDate 一起决定追溯起点 */
  createdAt?: string;
  /** 绑定的 AI 对话消息 id（确认幂等） */
  sourceMessageId?: string;
};

/** @deprecated 使用 RecurringItem */
export type Subscription = RecurringItem;
/** @deprecated 使用 RecurrenceKind */
export type SubscriptionCycle = RecurrenceKind;

/**
 * 自然语言解析接口契约（供 /api/parse-recurring 等消费）
 * 例：「工作日每天交通费 10.2 元，持续到 2027 年 6 月」
 * 例：「每月 10 号发工资 20000」
 */
export type RecurringParsePayload = {
  name: string;
  amount: number;
  direction: RecurringDirection;
  recurrence: {
    kind: RecurrenceKind;
    by_days?: WeekdayCode[];
    dayOfMonth?: number;
    end_date?: string | null;
  };
  nextDate?: string;
  remindDays?: number;
  rawText?: string;
  confidence?: number;
};

export type RecurringParseApiResponse =
  | { ok: true; data: RecurringParsePayload[] }
  | { ok: false; code: string; message: string };

export type BudgetSpendMode = "actual" | "reserve_fixed";

const ACCOUNTS_KEY = "cyberbookkeeper_planner_accounts";
const LEDGER_KEY = "cyberbookkeeper_planner_ledger";
const GOALS_KEY = "cyberbookkeeper_planner_goals";
const SUBS_KEY = "cyberbookkeeper_planner_subs";
export const BUDGET_SPEND_MODE_KEY = "cyberbookkeeper_budget_spend_mode";

export const ACCOUNT_EMOJIS = [
  "💳",
  "📱",
  "🏦",
  "💵",
  "💰",
  "🏧",
  "🪙",
  "💎",
] as const;

export const GOAL_EMOJIS = [
  "📱",
  "✈️",
  "🎮",
  "🏠",
  "💍",
  "🚗",
  "💻",
  "🎁",
  "🐱",
  "☕",
] as const;

/** 周期项分类图标 */
export const RECURRING_EMOJIS = [
  "☁️",
  "🎬",
  "🏠",
  "🚌",
  "💵",
  "📱",
  "☕",
  "🎮",
  "🛒",
  "💊",
  "🎵",
  "📦",
  "💳",
  "🛠️",
] as const;

export const WEEKDAY_OPTIONS: { code: WeekdayCode; label: string }[] = [
  { code: "MON", label: "一" },
  { code: "TUE", label: "二" },
  { code: "WED", label: "三" },
  { code: "THU", label: "四" },
  { code: "FRI", label: "五" },
  { code: "SAT", label: "六" },
  { code: "SUN", label: "日" },
];

export const WORKDAYS: WeekdayCode[] = ["MON", "TUE", "WED", "THU", "FRI"];

const JS_DAY_TO_CODE: WeekdayCode[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return localDateString(next);
}

export const DEFAULT_ACCOUNTS: PlannerAccount[] = [
  { id: "octopus", name: "八达通", emoji: "💳", balance: 286.5, note: "通勤卡" },
  { id: "alipay", name: "支付宝/微信", emoji: "📱", balance: 1280, note: "日常支付" },
  { id: "bank", name: "银行卡", emoji: "🏦", balance: 24800, note: "主账户" },
  { id: "cash", name: "现金", emoji: "💵", balance: 420, note: "随身现金" },
];

export const DEFAULT_GOALS: WishlistGoal[] = [];

const DEMO_GOAL_PURGED_KEY = "cyberbookkeeper_demo_goals_purged_v1";

/** 旧版演示种子 ID（曾在空列表时自动注入并 autoWrite 入账） */
export const LEGACY_DEMO_RECURRING_IDS = new Set([
  "rec-salary",
  "rec-transit",
  "sub-icloud",
  "sub-netflix",
  "sub-rent",
]);

/** 演示项指纹（名称+金额），防止 ID 被改写后仍残留 */
const LEGACY_DEMO_FINGERPRINTS = new Set([
  "每月工资|20000",
  "工资|20000",
  "工作日交通费|10.2",
  "icloud+|21",
  "netflix|78",
  "房租|9800",
]);

const DEMO_RECURRING_PURGED_KEY = "cyberbookkeeper_demo_recurring_purged_v2";

function demoFingerprint(name: string, amount: number) {
  return `${name.trim().toLowerCase()}|${Number(amount)}`;
}

/** 是否为旧演示周期项（按 ID 或名称+金额） */
export function isLegacyDemoRecurringItem(item: {
  id: string;
  name: string;
  amount: number;
}): boolean {
  if (LEGACY_DEMO_RECURRING_IDS.has(item.id)) return true;
  return LEGACY_DEMO_FINGERPRINTS.has(demoFingerprint(item.name, item.amount));
}

/** 不再提供演示周期项；空列表就是空，避免误自动记账 */
export function defaultRecurringItems(): RecurringItem[] {
  return [];
}

/** @deprecated */
export function defaultSubscriptions() {
  return defaultRecurringItems();
}

export function nextMonthlyDate(dayOfMonth: number, from = new Date()) {
  const y = from.getFullYear();
  const m = from.getMonth();
  const candidate = new Date(y, m, Math.min(dayOfMonth, daysInMonth(y, m)));
  if (localDateString(candidate) >= localDateString(from)) {
    return localDateString(candidate);
  }
  const next = new Date(y, m + 1, 1);
  const ny = next.getFullYear();
  const nm = next.getMonth();
  return localDateString(
    new Date(ny, nm, Math.min(dayOfMonth, daysInMonth(ny, nm))),
  );
}

/** 每年：指定月份（0–11）与几号，计算下一次发生日 */
export function nextYearlyDate(
  monthIndex: number,
  dayOfMonth: number,
  from = new Date(),
) {
  const m = Math.min(11, Math.max(0, monthIndex));
  const y = from.getFullYear();
  const candidate = new Date(y, m, Math.min(dayOfMonth, daysInMonth(y, m)));
  if (localDateString(candidate) >= localDateString(from)) {
    return localDateString(candidate);
  }
  const ny = y + 1;
  return localDateString(
    new Date(ny, m, Math.min(dayOfMonth, daysInMonth(ny, m))),
  );
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function nextByDaysDate(byDays: WeekdayCode[], from = new Date()) {
  const set = new Set(byDays);
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    if (set.has(JS_DAY_TO_CODE[d.getDay()])) return localDateString(d);
  }
  return localDateString(from);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** 兼容旧版 Subscription（仅 cycle / nextChargeDate） */
export function normalizeRecurringItem(raw: unknown): RecurringItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = String(item.id ?? uid());
  const name = String(item.name ?? "未命名").trim() || "未命名";
  const amount = Number(item.amount);
  if (!Number.isFinite(amount)) return null;

  const direction: RecurringDirection =
    item.direction === "income" ? "income" : "expense";

  let recurrence: RecurrenceRule;
  if (item.recurrence && typeof item.recurrence === "object") {
    const r = item.recurrence as Record<string, unknown>;
    const kind =
      r.kind === "yearly" || r.kind === "by_days" || r.kind === "monthly"
        ? r.kind
        : "monthly";
    recurrence = {
      kind,
      dayOfMonth:
        typeof r.dayOfMonth === "number" ? r.dayOfMonth : undefined,
      by_days: Array.isArray(r.by_days)
        ? (r.by_days.filter((d) =>
            WEEKDAY_OPTIONS.some((w) => w.code === d),
          ) as WeekdayCode[])
        : undefined,
      end_date:
        typeof r.end_date === "string" && r.end_date
          ? r.end_date
          : r.end_date === null
            ? null
            : undefined,
    };
  } else {
    const cycle = item.cycle === "yearly" ? "yearly" : "monthly";
    recurrence = { kind: cycle, end_date: null };
  }

  const nextDate = String(
    item.nextDate ?? item.nextChargeDate ?? addDays(new Date(), 7),
  );

  return {
    id,
    name,
    amount,
    direction,
    recurrence,
    nextDate,
    remindDays: Math.max(0, Number(item.remindDays) || 0),
    autoWrite: item.autoWrite !== false,
    category:
      typeof item.category === "string" && item.category.trim()
        ? item.category.trim()
        : undefined,
    emoji:
      typeof item.emoji === "string" && item.emoji.trim()
        ? item.emoji.trim()
        : undefined,
    currency: normalizeCurrency(item.currency),
    startDate:
      typeof item.startDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.startDate)
        ? item.startDate
        : undefined,
    createdAt:
      typeof item.createdAt === "string" && item.createdAt
        ? item.createdAt
        : undefined,
    sourceMessageId:
      typeof item.sourceMessageId === "string" && item.sourceMessageId
        ? item.sourceMessageId
        : undefined,
  };
}

export function readAccounts(): PlannerAccount[] {
  return readJson(ACCOUNTS_KEY, DEFAULT_ACCOUNTS);
}

export function writeAccounts(accounts: PlannerAccount[]) {
  writeJson(ACCOUNTS_KEY, accounts);
}

export function readLedger(): AccountLedgerEntry[] {
  return readJson(LEDGER_KEY, [] as AccountLedgerEntry[]);
}

export function writeLedger(entries: AccountLedgerEntry[]) {
  writeJson(LEDGER_KEY, entries);
}

export function readGoals(): WishlistGoal[] {
  if (typeof window === "undefined") return [];
  const raw = readJson<unknown[] | null>(GOALS_KEY, null);
  if (!Array.isArray(raw)) {
    writeJson(GOALS_KEY, []);
    return [];
  }
  const cleaned = raw.filter((g) => {
    if (!g || typeof g !== "object") return false;
    const row = g as Record<string, unknown>;
    if (row.id === "goal-phone") return false;
    if (row.title === "换新手机" && Number(row.saved) === 5200) return false;
    return true;
  }) as WishlistGoal[];
  if (
    cleaned.length !== raw.length ||
    localStorage.getItem(DEMO_GOAL_PURGED_KEY) !== "1"
  ) {
    writeJson(GOALS_KEY, cleaned);
    localStorage.setItem(DEMO_GOAL_PURGED_KEY, "1");
  }
  return cleaned;
}

export function writeGoals(goals: WishlistGoal[]) {
  writeJson(GOALS_KEY, goals);
}

export function readRecurringItems(): RecurringItem[] {
  if (typeof window === "undefined") return [];

  const raw = readJson<unknown[]>(SUBS_KEY, []);
  if (!Array.isArray(raw) || raw.length === 0) {
    // 显式写成 []，避免旧逻辑/缓存误以为「未初始化」
    if (localStorage.getItem(SUBS_KEY) == null) {
      writeJson(SUBS_KEY, []);
    }
    return [];
  }

  const normalized = raw
    .map(normalizeRecurringItem)
    .filter((item): item is RecurringItem => item !== null);

  const cleaned = normalized.filter((item) => !isLegacyDemoRecurringItem(item));
  const changed =
    cleaned.length !== normalized.length ||
    localStorage.getItem(DEMO_RECURRING_PURGED_KEY) !== "1";

  if (cleaned.length !== normalized.length) {
    writeJson(SUBS_KEY, cleaned);
  }
  if (changed) {
    localStorage.setItem(DEMO_RECURRING_PURGED_KEY, "1");
  }
  return cleaned;
}

export function writeRecurringItems(items: RecurringItem[]) {
  const cleaned = items.filter((item) => !isLegacyDemoRecurringItem(item));
  writeJson(SUBS_KEY, cleaned);
}

/** @deprecated */
export function readSubscriptions() {
  return readRecurringItems();
}

/** @deprecated */
export function writeSubscriptions(items: RecurringItem[]) {
  writeRecurringItems(items);
}

export function readBudgetSpendMode(): BudgetSpendMode {
  const raw = readJson<string>(BUDGET_SPEND_MODE_KEY, "actual");
  return raw === "reserve_fixed" ? "reserve_fixed" : "actual";
}

export function writeBudgetSpendMode(mode: BudgetSpendMode) {
  writeJson(BUDGET_SPEND_MODE_KEY, mode);
}

export function sumBalances(accounts: PlannerAccount[]) {
  return accounts.reduce((sum, item) => sum + Number(item.balance), 0);
}

export function daysUntil(date: string) {
  const today = new Date(`${localDateString()}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatChargeDate(date: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatEndMonth(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function weekdayLabel(codes: WeekdayCode[]) {
  if (
    codes.length === 5 &&
    WORKDAYS.every((d) => codes.includes(d)) &&
    !codes.includes("SAT") &&
    !codes.includes("SUN")
  ) {
    return "工作日";
  }
  return codes
    .map((c) => WEEKDAY_OPTIONS.find((w) => w.code === c)?.label ?? c)
    .join("");
}

export function formatRecurringLine(item: RecurringItem): {
  amountLine: string;
  detailLine: string;
} {
  const end = item.recurrence.end_date
    ? `持续至 ${formatEndMonth(item.recurrence.end_date)}`
    : null;

  if (item.recurrence.kind === "by_days") {
    const days = item.recurrence.by_days ?? [];
    const amountDisplay =
      item.direction === "income"
        ? `+${formatHKD(item.amount)}/天`
        : `${formatHKD(item.amount)}/天`;
    const detail = [weekdayLabel(days), end].filter(Boolean).join(" · ");
    return { amountLine: amountDisplay, detailLine: detail };
  }

  const amountDisplay =
    item.direction === "income"
      ? `+${formatHKD(item.amount)}`
      : formatHKD(item.amount);

  if (item.recurrence.kind === "monthly") {
    const day =
      item.recurrence.dayOfMonth ??
      Number(item.nextDate.slice(8, 10)) ??
      undefined;
    if (item.direction === "income") {
      return {
        amountLine: amountDisplay,
        detailLine: [day ? `每月${day}日` : "每月", end]
          .filter(Boolean)
          .join(" · "),
      };
    }
    return {
      amountLine: `${amountDisplay} / 月`,
      detailLine: [
        day ? `每月${day}日` : item.nextDate ? `下次 ${formatChargeDate(item.nextDate)}` : "",
        end,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  return {
    amountLine: `${amountDisplay} / 年`,
    detailLine: [
      item.nextDate ? `下次 ${formatChargeDate(item.nextDate)}` : "",
      end,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function goalProgress(goal: WishlistGoal) {
  if (goal.target <= 0) return 0;
  return Math.min(100, (goal.saved / goal.target) * 100);
}

export function countByDaysOccurrences(
  byDays: WeekdayCode[],
  from: Date,
  to: Date,
) {
  const set = new Set(byDays);
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    if (set.has(JS_DAY_TO_CODE[cur.getDay()])) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * 预估本月剩余固定开销（自今天至月末；已记入账单的项可传入 loggedKeys 排除）
 */
export function estimateRemainingFixedExpenses(
  items: RecurringItem[],
  date = new Date(),
  loggedKeys?: Set<string>,
) {
  const { lastDay } = getMonthRange(date);
  const today = localDateString(date);
  let total = 0;

  for (const item of items) {
    if (item.direction !== "expense") continue;
    const endDate = item.recurrence.end_date ?? null;
    if (endDate && endDate < today) continue;
    const rangeEnd = endDate && endDate < lastDay ? endDate : lastDay;

    if (item.recurrence.kind === "by_days") {
      const days = item.recurrence.by_days ?? [];
      if (days.length === 0) continue;
      const cur = new Date(date);
      cur.setHours(0, 0, 0, 0);
      const end = new Date(`${rangeEnd}T00:00:00`);
      while (cur <= end) {
        const code = JS_DAY_TO_CODE[cur.getDay()];
        const key = `${item.id}:${localDateString(cur)}`;
        if (days.includes(code) && !loggedKeys?.has(key)) {
          total += item.amount;
        }
        cur.setDate(cur.getDate() + 1);
      }
      continue;
    }

    const occ = occurrenceDateInMonth(item, date);
    if (!occ || occ < today || occ > rangeEnd) continue;
    const key = `${item.id}:${occ}`;
    if (loggedKeys?.has(key)) continue;
    total += item.amount;
  }

  return total;
}

/** 本月该周期项的应发生日期（monthly/yearly）；by_days 返回 null */
export function occurrenceDateInMonth(
  item: RecurringItem,
  date = new Date(),
): string | null {
  const { firstDay, lastDay } = getMonthRange(date);
  const endDate = item.recurrence.end_date ?? null;
  if (endDate && endDate < firstDay) return null;

  if (item.recurrence.kind === "by_days") return null;

  if (item.recurrence.kind === "yearly") {
    const month = Number(item.nextDate.slice(5, 7)) - 1;
    if (month !== date.getMonth()) return null;
  }

  const day =
    item.recurrence.dayOfMonth ??
    Number(item.nextDate.slice(8, 10)) ??
    date.getDate();
  const y = date.getFullYear();
  const m = date.getMonth();
  const dim = daysInMonth(y, m);
  const occ = localDateString(new Date(y, m, Math.min(Math.max(1, day), dim)));
  if (occ < firstDay || occ > lastDay) return null;
  if (endDate && occ > endDate) return null;
  return occ;
}

export function inferRecurringCategory(item: RecurringItem): string {
  if (item.category) return item.category;
  if (item.direction === "income") return "工资";
  const n = item.name;
  if (/房租|租金|居住|住房/.test(n)) return "居住";
  if (/交通|地铁|巴士|八达通|通勤/.test(n)) return "交通";
  if (/餐|吃|外卖/.test(n)) return "餐饮";
  if (/Netflix|Spotify|YouTube|订阅|iCloud|Disney/.test(n)) return "娱乐";
  if (/数码|手机|电脑/.test(n)) return "数码";
  return "其它";
}

export function createAccount(
  partial?: Partial<Omit<PlannerAccount, "id">>,
): PlannerAccount {
  return {
    id: uid(),
    name: partial?.name?.trim() || "新账户",
    emoji: partial?.emoji || "💳",
    balance: Number(partial?.balance) || 0,
    note: partial?.note?.trim() || "",
  };
}

export function createGoal(
  partial?: Partial<Omit<WishlistGoal, "id">>,
): WishlistGoal {
  return {
    id: uid(),
    title: partial?.title?.trim() || "新愿望",
    emoji: partial?.emoji || "🎁",
    target: Number(partial?.target) || 0,
    saved: Number(partial?.saved) || 0,
  };
}

export function createLedgerEntry(
  accountId: string,
  amount: number,
  note: string,
): AccountLedgerEntry {
  return {
    id: uid(),
    accountId,
    amount,
    note: note.trim() || "余额调整",
    date: localDateString(),
    createdAt: new Date().toISOString(),
  };
}

export function createRecurringItem(
  partial?: Partial<Omit<RecurringItem, "id">>,
): RecurringItem {
  const direction = partial?.direction ?? "expense";
  const recurrence: RecurrenceRule = partial?.recurrence ?? {
    kind: "monthly",
    end_date: null,
  };
  let nextDate = partial?.nextDate;
  if (!nextDate) {
    if (recurrence.kind === "by_days") {
      nextDate = nextByDaysDate(recurrence.by_days ?? WORKDAYS);
    } else if (recurrence.dayOfMonth) {
      nextDate = nextMonthlyDate(recurrence.dayOfMonth);
    } else {
      nextDate = addDays(new Date(), 7);
    }
  }
  const today = localDateString();
  return {
    id: uid(),
    name: partial?.name?.trim() || "新周期项",
    amount: Number(partial?.amount) || 0,
    direction,
    recurrence,
    nextDate,
    remindDays: partial?.remindDays ?? 3,
    autoWrite: partial?.autoWrite !== false,
    category: partial?.category?.trim() || undefined,
    emoji: partial?.emoji?.trim() || undefined,
    currency: normalizeCurrency(partial?.currency ?? DEFAULT_CURRENCY),
    startDate:
      partial?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(partial.startDate)
        ? partial.startDate
        : today,
    createdAt: partial?.createdAt || new Date().toISOString(),
    sourceMessageId: partial?.sourceMessageId,
  };
}

/** @deprecated */
export function createSubscription(
  partial?: Partial<RecurringItem> & { cycle?: RecurrenceKind; nextChargeDate?: string },
): RecurringItem {
  return createRecurringItem({
    ...partial,
    nextDate: partial?.nextDate ?? partial?.nextChargeDate,
    recurrence:
      partial?.recurrence ??
      (partial?.cycle
        ? { kind: partial.cycle === "by_days" ? "by_days" : partial.cycle, end_date: null }
        : undefined),
  });
}

/** 将自然语言解析结果转为可入库条目 */
export function fromParsePayload(payload: RecurringParsePayload): RecurringItem {
  return createRecurringItem({
    name: payload.name,
    amount: payload.amount,
    direction: payload.direction,
    recurrence: {
      kind: payload.recurrence.kind,
      by_days: payload.recurrence.by_days,
      dayOfMonth: payload.recurrence.dayOfMonth,
      end_date: payload.recurrence.end_date ?? null,
    },
    nextDate: payload.nextDate,
    remindDays: payload.remindDays ?? 3,
  });
}

export { formatHKD, uid };
