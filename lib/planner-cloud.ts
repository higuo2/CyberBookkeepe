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
import {
  applyCanStateFromCloud,
  canStateForCloud,
  clearCanEconomyLocal,
  type CanEconomyState,
} from "@/lib/can-system";
import { isThemeId, type ThemeId } from "@/lib/cream-theme";

export type PlannerCloudSnapshot = {
  goals: WishlistGoal[];
  recurring: RecurringItem[];
  monthly_budget: number;
  spend_mode: BudgetSpendMode;
  accounts: PlannerAccount[];
  ledger: AccountLedgerEntry[];
  can?: CanEconomyState;
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

function asThemeList(raw: unknown): ThemeId[] {
  if (!Array.isArray(raw)) return ["cream"];
  const list = raw.filter((t): t is ThemeId => isThemeId(t));
  return list.includes("cream") ? list : (["cream", ...list] as ThemeId[]);
}

function canFromRow(row: Record<string, unknown>): CanEconomyState {
  return {
    cans_count: Math.max(0, Math.floor(Number(row.cans_count) || 0)),
    can_fragments: Math.max(0, Math.floor(Number(row.can_fragments) || 0)),
    unlocked_themes: asThemeList(row.unlocked_themes),
    current_theme: isThemeId(row.current_theme) ? row.current_theme : "cream",
    checkin_streak: Math.max(0, Math.floor(Number(row.checkin_streak) || 0)),
    last_checkin_date:
      typeof row.last_checkin_date === "string" && row.last_checkin_date
        ? row.last_checkin_date
        : null,
    completed_milestones: Array.isArray(row.completed_milestones)
      ? row.completed_milestones.filter((m): m is string => typeof m === "string")
      : [],
    last_sponsor_claim_date:
      typeof row.last_sponsor_claim_date === "string" &&
      row.last_sponsor_claim_date
        ? row.last_sponsor_claim_date
        : null,
  };
}

function snapshotFromLocal(): PlannerCloudSnapshot {
  return {
    goals: readGoals(),
    recurring: readRecurringItems(),
    monthly_budget: readBudgetFromStorage(),
    spend_mode: readBudgetSpendMode(),
    accounts: readAccounts(),
    ledger: readLedger(),
    can: canStateForCloud(),
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
  if (s.can) applyCanStateFromCloud(s.can);
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
    can: canFromRow(row),
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function fetchPlannerCloud(): Promise<PlannerCloudSnapshot | null> {
  const { data, error } = await getSupabase()
    .from("planner_state")
    .select(
      "goals, recurring, monthly_budget, spend_mode, accounts, ledger, cans_count, can_fragments, unlocked_themes, current_theme, checkin_streak, last_checkin_date, completed_milestones, last_sponsor_claim_date, updated_at",
    )
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToSnapshot(data as Record<string, unknown>);
}

function canPayload(can: CanEconomyState) {
  return {
    cans_count: can.cans_count,
    can_fragments: can.can_fragments,
    unlocked_themes: can.unlocked_themes,
    current_theme: can.current_theme,
    checkin_streak: can.checkin_streak,
    last_checkin_date: can.last_checkin_date,
    completed_milestones: can.completed_milestones,
    last_sponsor_claim_date: can.last_sponsor_claim_date,
  };
}

export async function pushPlannerToCloud(
  snapshot?: PlannerCloudSnapshot,
): Promise<void> {
  if (!isBrowser()) return;
  const local = snapshot ?? snapshotFromLocal();
  const can = local.can ?? canStateForCloud();
  const { error } = await getSupabase().from("planner_state").upsert(
    {
      id: ROW_ID,
      goals: local.goals,
      recurring: local.recurring,
      monthly_budget: local.monthly_budget,
      spend_mode: local.spend_mode,
      accounts: local.accounts,
      ledger: local.ledger,
      ...canPayload(can),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export function schedulePlannerCloudPush(delayMs = 400) {
  if (!isBrowser()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushInFlight = pushPlannerToCloud()
      .catch(() => {
        // best-effort
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

      if (!isEmptySnapshot(local) && !everHydrated) {
        await pushPlannerToCloud(local);
        return;
      }

      if (remote) {
        applySnapshotWithoutCloudPush(remote);
        window.dispatchEvent(new Event("planner-cloud-hydrated"));
        return;
      }

      await pushPlannerToCloud(local);
    } catch {
      // 表未建 / 缺列时：继续用本地
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

export async function clearPlannerCloud(): Promise<void> {
  const emptyCan: CanEconomyState = {
    cans_count: 0,
    can_fragments: 0,
    unlocked_themes: ["cream"],
    current_theme: "cream",
    checkin_streak: 0,
    last_checkin_date: null,
    completed_milestones: [],
    last_sponsor_claim_date: null,
  };
  await getSupabase().from("planner_state").upsert(
    {
      id: ROW_ID,
      goals: [],
      recurring: [],
      monthly_budget: 0,
      spend_mode: "actual",
      accounts: [],
      ledger: [],
      ...canPayload(emptyCan),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  try {
    localStorage.removeItem(HYDRATED_FLAG);
    localStorage.removeItem(BUDGET_STORAGE_KEY);
    localStorage.removeItem(BUDGET_SPEND_MODE_KEY);
    clearCanEconomyLocal();
  } catch {
    // ignore
  }
}
