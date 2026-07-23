import { getSupabase } from "@/lib/supabase";
import {
  BUDGET_SPEND_MODE_KEY,
  normalizeRecurringItem,
  type BudgetSpendMode,
  type PlannerAccount,
  type AccountLedgerEntry,
  type RecurringItem,
  type WishlistGoal,
  readAccounts,
  readBudgetSpendMode,
  readGoals,
  readLedger,
  readRecurringItems,
  writeAccounts,
  writeBudgetSpendMode,
  writeGoals,
  writeLedger,
  writeRecurringItems,
} from "@/lib/planner";
import {
  BUDGET_STORAGE_KEY,
  readBudgetFromStorage,
  writeBudgetToStorage,
} from "@/lib/transaction-utils";

export type PlannerCloudSnapshot = {
  goals: WishlistGoal[];
  recurring: RecurringItem[];
  monthly_budget: number;
  spend_mode: BudgetSpendMode;
  accounts: PlannerAccount[];
  ledger: AccountLedgerEntry[];
  updated_at?: string;
};

const ROW_ID = "default";
const HYDRATED_FLAG = "cyberbookkeeper_planner_cloud_hydrated_v1";

let hydratePromise: Promise<void> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight: Promise<void> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function asGoals(raw: unknown): WishlistGoal[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((g): g is WishlistGoal => {
    if (!g || typeof g !== "object") return false;
    const row = g as Record<string, unknown>;
    return typeof row.id === "string" && typeof row.title === "string";
  });
}

function asRecurring(raw: unknown): RecurringItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeRecurringItem)
    .filter((item): item is RecurringItem => item !== null);
}

function asAccounts(raw: unknown): PlannerAccount[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is PlannerAccount => {
    if (!a || typeof a !== "object") return false;
    const row = a as Record<string, unknown>;
    return typeof row.id === "string" && typeof row.name === "string";
  });
}

function asLedger(raw: unknown): AccountLedgerEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is AccountLedgerEntry => {
    if (!e || typeof e !== "object") return false;
    const row = e as Record<string, unknown>;
    return typeof row.id === "string" && typeof row.accountId === "string";
  });
}

function snapshotFromLocal(): PlannerCloudSnapshot {
  return {
    goals: readGoals(),
    recurring: readRecurringItems(),
    monthly_budget: readBudgetFromStorage(),
    spend_mode: readBudgetSpendMode(),
    accounts: readAccounts(),
    ledger: readLedger(),
  };
}

function isEmptySnapshot(s: PlannerCloudSnapshot) {
  return (
    s.monthly_budget <= 0 &&
    s.goals.length === 0 &&
    s.recurring.length === 0 &&
    s.ledger.length === 0
  );
}

function applySnapshotLocally(s: PlannerCloudSnapshot) {
  writeGoals(s.goals);
  writeRecurringItems(s.recurring);
  writeBudgetToStorage(s.monthly_budget);
  writeBudgetSpendMode(s.spend_mode);
  if (s.accounts.length > 0) writeAccounts(s.accounts);
  writeLedger(s.ledger);
}

function rowToSnapshot(row: Record<string, unknown>): PlannerCloudSnapshot {
  const spend =
    row.spend_mode === "reserve_fixed" ? "reserve_fixed" : "actual";
  const budget = Number(row.monthly_budget);
  return {
    goals: asGoals(row.goals),
    recurring: asRecurring(row.recurring),
    monthly_budget: Number.isFinite(budget) && budget > 0 ? budget : 0,
    spend_mode: spend,
    accounts: asAccounts(row.accounts),
    ledger: asLedger(row.ledger),
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function fetchPlannerCloud(): Promise<PlannerCloudSnapshot | null> {
  const { data, error } = await getSupabase()
    .from("planner_state")
    .select(
      "goals, recurring, monthly_budget, spend_mode, accounts, ledger, updated_at",
    )
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToSnapshot(data as Record<string, unknown>);
}

/** 把当前 localStorage 规划数据整包 upsert 到云端 */
export async function pushPlannerToCloud(
  snapshot?: PlannerCloudSnapshot,
): Promise<void> {
  if (!isBrowser()) return;
  const local = snapshot ?? snapshotFromLocal();
  const { error } = await getSupabase().from("planner_state").upsert(
    {
      id: ROW_ID,
      goals: local.goals,
      recurring: local.recurring,
      monthly_budget: local.monthly_budget,
      spend_mode: local.spend_mode,
      accounts: local.accounts,
      ledger: local.ledger,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

/** 写入后防抖推送；不阻塞 UI */
export function schedulePlannerCloudPush(delayMs = 400) {
  if (!isBrowser()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushInFlight = pushPlannerToCloud()
      .catch(() => {
        // best-effort；下次写入或下次打开再同步
      })
      .finally(() => {
        pushInFlight = null;
      });
  }, delayMs);
}

export async function flushPlannerCloudPush() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pushInFlight) await pushInFlight;
  else await pushPlannerToCloud().catch(() => undefined);
}

/**
 * 启动时拉取云端规划：
 * - 云端有内容 → 覆盖本地（跨设备同步）
 * - 云端空、本地有内容 → 上传本地（首次迁移）
 * 同会话只跑一次。
 */
export function hydratePlannerFromCloud(): Promise<void> {
  if (!isBrowser()) return Promise.resolve();
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const remote = await fetchPlannerCloud();
      const local = snapshotFromLocal();
      const everHydrated = localStorage.getItem(HYDRATED_FLAG) === "1";

      if (remote && !isEmptySnapshot(remote)) {
        applySnapshotWithoutCloudPush(remote);
        window.dispatchEvent(new Event("planner-cloud-hydrated"));
        return;
      }

      // 云端空：仅首次（本机尚未 hydrate）且本地有数据 → 上传迁移
      if (!isEmptySnapshot(local) && !everHydrated) {
        await pushPlannerToCloud(local);
        return;
      }

      if (remote) {
        // 云端有行但是空（例如设置里点了重置）→ 覆盖本地
        applySnapshotWithoutCloudPush(remote);
        window.dispatchEvent(new Event("planner-cloud-hydrated"));
        return;
      }

      // 云端尚无行：创建 default
      await pushPlannerToCloud(local);
    } catch {
      // 表未建 / 网络失败：继续用本地
    } finally {
      try {
        localStorage.setItem(HYDRATED_FLAG, "1");
      } catch {
        // ignore
      }
    }
  })();

  return hydratePromise;
}

/** 应用快照但不触发 schedulePush（供 hydrate 使用） */
function applySnapshotWithoutCloudPush(s: PlannerCloudSnapshot) {
  const prev = (globalThis as { __plannerCloudMutePush?: boolean })
    .__plannerCloudMutePush;
  (globalThis as { __plannerCloudMutePush?: boolean }).__plannerCloudMutePush =
    true;
  try {
    applySnapshotLocally(s);
  } finally {
    (globalThis as { __plannerCloudMutePush?: boolean }).__plannerCloudMutePush =
      prev;
  }
}

export function isPlannerCloudPushMuted() {
  return Boolean(
    (globalThis as { __plannerCloudMutePush?: boolean }).__plannerCloudMutePush,
  );
}

/** 设置页「重置」时清空云端规划 */
export async function clearPlannerCloud(): Promise<void> {
  await getSupabase().from("planner_state").upsert(
    {
      id: ROW_ID,
      goals: [],
      recurring: [],
      monthly_budget: 0,
      spend_mode: "actual",
      accounts: [],
      ledger: [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  try {
    localStorage.removeItem(HYDRATED_FLAG);
    localStorage.removeItem(BUDGET_STORAGE_KEY);
    localStorage.removeItem(BUDGET_SPEND_MODE_KEY);
  } catch {
    // ignore
  }
}
