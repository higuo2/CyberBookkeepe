import { localDateString } from "@/lib/transaction-utils";
import {
  STORE_THEMES,
  getThemeConfig,
  type ThemeId,
  isThemeId,
} from "@/lib/cream-theme";

export type MilestoneId =
  | "milestone_budget"
  | "milestone_export"
  | "milestone_recurring"
  | "code_river666"
  | "code_cyber2026";

export type CanEconomyState = {
  cans_count: number;
  can_fragments: number;
  unlocked_themes: ThemeId[];
  current_theme: ThemeId;
  checkin_streak: number;
  last_checkin_date: string | null;
  completed_milestones: string[];
  last_sponsor_claim_date: string | null;
};

export type CheckinResult = {
  didCheckin: boolean;
  fragmentGained: boolean;
  synthesizedCan: boolean;
  streakBonus: boolean;
  streak: number;
  state: CanEconomyState;
};

export type RedeemResult =
  | { ok: true; cansAdded: number; state: CanEconomyState; messageKey: string }
  | { ok: false; messageKey: string; state: CanEconomyState };

const STORAGE_KEY = "cyberbookkeeper_can_economy_v1";
const THEME_STORAGE_KEY = "cyberbookkeeper_current_theme";
export const CAN_STATE_EVENT = "can-economy-updated";

const REDEEM_CODES: Record<string, { milestone: MilestoneId; cans: number }> = {
  RIVER666: { milestone: "code_river666", cans: 2 },
  CYBER2026: { milestone: "code_cyber2026", cans: 2 },
};

export function triggerHaptic() {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(12);
    } catch {
      // ignore
    }
  }
}

function defaultState(): CanEconomyState {
  return {
    cans_count: 0,
    can_fragments: 0,
    unlocked_themes: ["cream"],
    current_theme: "cream",
    checkin_streak: 0,
    last_checkin_date: null,
    completed_milestones: [],
    last_sponsor_claim_date: null,
  };
}

function normalizeState(raw: unknown): CanEconomyState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  const unlocked = Array.isArray(row.unlocked_themes)
    ? row.unlocked_themes.filter((t): t is ThemeId => isThemeId(t))
    : (["cream"] as ThemeId[]);
  const themes: ThemeId[] = unlocked.includes("cream")
    ? unlocked
    : ["cream", ...unlocked];
  const current = isThemeId(row.current_theme) ? row.current_theme : "cream";
  return {
    cans_count: Math.max(0, Math.floor(Number(row.cans_count) || 0)),
    can_fragments: Math.max(0, Math.floor(Number(row.can_fragments) || 0)),
    unlocked_themes: themes,
    current_theme: themes.includes(current) ? current : "cream",
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

export function readCanState(): CanEconomyState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function writeCanState(state: CanEconomyState) {
  if (typeof window === "undefined") return;
  const normalized = normalizeState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem(THEME_STORAGE_KEY, normalized.current_theme);
  window.dispatchEvent(
    new CustomEvent(CAN_STATE_EVENT, { detail: normalized }),
  );
  if (
    !(globalThis as { __plannerCloudMutePush?: boolean }).__plannerCloudMutePush
  ) {
    void import("@/lib/planner-cloud").then((m) => m.schedulePlannerCloudPush());
  }
}

/** 供云端 hydrate：不触发二次 push */
export function applyCanStateFromCloud(partial: Partial<CanEconomyState>) {
  const next = normalizeState({ ...readCanState(), ...partial });
  const prev = (globalThis as { __plannerCloudMutePush?: boolean })
    .__plannerCloudMutePush;
  (globalThis as { __plannerCloudMutePush?: boolean }).__plannerCloudMutePush =
    true;
  try {
    writeCanState(next);
    applyThemeToDocument(next.current_theme);
  } finally {
    (globalThis as { __plannerCloudMutePush?: boolean }).__plannerCloudMutePush =
      prev;
  }
}

export function canStateForCloud(): CanEconomyState {
  return readCanState();
}

/** 仅预览：改 DOM，不持久化 */
export function previewTheme(themeId: ThemeId) {
  applyThemeToDocument(themeId);
}

/** 恢复已保存主题（关闭预览） */
export function restoreSavedTheme() {
  applyThemeToDocument(readCanState().current_theme);
}

export function applyThemeToDocument(themeId: ThemeId) {
  if (typeof document === "undefined") return;
  const theme = getThemeConfig(themeId);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  const c = theme.tokens;
  root.style.setProperty("--cream-bg", c.bg);
  root.style.setProperty("--cream-bg-soft", c.bgSoft);
  root.style.setProperty("--cream-card", c.card);
  root.style.setProperty("--cream-border", c.border);
  root.style.setProperty("--cream-divide", c.divide);
  root.style.setProperty("--brand-primary", c.primary);
  root.style.setProperty("--ink", c.ink);
  root.style.setProperty("--ink-body", c.inkBody);
  root.style.setProperty("--ink-muted", c.inkMuted);
  root.style.setProperty("--bg-main", c.bg);
  root.style.setProperty("--card-bg", c.card);
  root.style.setProperty("--primary", c.primary);
  root.style.setProperty("--text-main", c.ink);
  root.style.setProperty("--color-bg-main", c.bg);
  root.style.setProperty("--color-bg-card", c.card);
  root.style.setProperty("--color-bg-soft", c.divide);
  root.style.setProperty("--color-border", c.border);
  root.style.setProperty("--color-border-theme", c.border);
  root.style.setProperty("--color-primary", c.primary);
  root.style.setProperty("--color-text-main", c.ink);
  root.style.setProperty("--color-text-body", c.inkBody);
  root.style.setProperty("--color-text-muted", c.inkMuted);
  root.style.colorScheme = c.scheme;
}

export function hydrateThemeOnBoot() {
  if (typeof window === "undefined") return;
  const fromLs = localStorage.getItem(THEME_STORAGE_KEY);
  const state = readCanState();
  const id =
    (isThemeId(fromLs) ? fromLs : null) ?? state.current_theme ?? "cream";
  applyThemeToDocument(id);
}

function dayDiff(fromYmd: string, toYmd: string) {
  const a = new Date(`${fromYmd}T00:00:00`);
  const b = new Date(`${toYmd}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function synthesizeFragments(state: CanEconomyState): {
  state: CanEconomyState;
  synthesized: boolean;
} {
  let cans = state.cans_count;
  let frags = state.can_fragments;
  let synthesized = false;
  while (frags >= 3) {
    frags -= 3;
    cans += 1;
    synthesized = true;
  }
  return {
    state: { ...state, cans_count: cans, can_fragments: frags },
    synthesized,
  };
}

/** 用户主动确认存入账单后调用（每日仅首次生效） */
export function processDailyCheckin(): CheckinResult {
  const today = localDateString();
  let state = readCanState();
  if (state.last_checkin_date === today) {
    return {
      didCheckin: false,
      fragmentGained: false,
      synthesizedCan: false,
      streakBonus: false,
      streak: state.checkin_streak,
      state,
    };
  }

  let streak = 1;
  if (state.last_checkin_date) {
    const diff = dayDiff(state.last_checkin_date, today);
    streak = diff === 1 ? state.checkin_streak + 1 : 1;
  }

  state = {
    ...state,
    can_fragments: state.can_fragments + 1,
    checkin_streak: streak,
    last_checkin_date: today,
  };

  const syn = synthesizeFragments(state);
  state = syn.state;

  let streakBonus = false;
  if (streak > 0 && streak % 7 === 0) {
    state = { ...state, cans_count: state.cans_count + 1 };
    streakBonus = true;
  }

  writeCanState(state);
  triggerHaptic();
  return {
    didCheckin: true,
    fragmentGained: true,
    synthesizedCan: syn.synthesized,
    streakBonus,
    streak,
    state,
  };
}

export function completeMilestone(id: MilestoneId): {
  awarded: boolean;
  state: CanEconomyState;
} {
  let state = readCanState();
  if (state.completed_milestones.includes(id)) {
    return { awarded: false, state };
  }
  state = {
    ...state,
    cans_count: state.cans_count + 1,
    completed_milestones: [...state.completed_milestones, id],
  };
  writeCanState(state);
  triggerHaptic();
  return { awarded: true, state };
}

export function claimSponsorCans(): RedeemResult {
  let state = readCanState();
  // 可随时多次领取；仅记录最近一次日期（云同步/统计用），不做日限拦截
  state = {
    ...state,
    cans_count: state.cans_count + 2,
    last_sponsor_claim_date: localDateString(),
  };
  writeCanState(state);
  triggerHaptic();
  return {
    ok: true,
    cansAdded: 2,
    state,
    messageKey: "can.sponsor.thanks",
  };
}

export function redeemCode(raw: string): RedeemResult {
  const code = raw.trim().toUpperCase();
  const entry = REDEEM_CODES[code];
  if (!entry) {
    return { ok: false, messageKey: "can.code.invalid", state: readCanState() };
  }
  let state = readCanState();
  if (state.completed_milestones.includes(entry.milestone)) {
    return { ok: false, messageKey: "can.code.used", state };
  }
  state = {
    ...state,
    cans_count: state.cans_count + entry.cans,
    completed_milestones: [...state.completed_milestones, entry.milestone],
  };
  writeCanState(state);
  triggerHaptic();
  return {
    ok: true,
    cansAdded: entry.cans,
    state,
    messageKey: "can.code.success",
  };
}

export function unlockAndApplyTheme(themeId: ThemeId): RedeemResult {
  const theme = getThemeConfig(themeId);
  let state = readCanState();
  const unlocked = state.unlocked_themes.includes(themeId);

  if (!unlocked) {
    if (theme.cost > state.cans_count) {
      return { ok: false, messageKey: "can.theme.insufficient", state };
    }
    state = {
      ...state,
      cans_count: state.cans_count - theme.cost,
      unlocked_themes: [...state.unlocked_themes, themeId],
      current_theme: themeId,
    };
  } else {
    state = { ...state, current_theme: themeId };
  }

  writeCanState(state);
  applyThemeToDocument(themeId);
  triggerHaptic();
  return {
    ok: true,
    cansAdded: 0,
    state,
    messageKey: unlocked ? "can.theme.applied" : "can.theme.unlocked",
  };
}

export function themeDisplayName(id: ThemeId) {
  return STORE_THEMES.find((t) => t.id === id)?.name ?? id;
}

export function clearCanEconomyLocal() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(THEME_STORAGE_KEY);
  applyThemeToDocument("cream");
}
