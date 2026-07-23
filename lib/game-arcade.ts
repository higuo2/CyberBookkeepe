import { localDateString } from "@/lib/transaction-utils";
import { readCanState, writeCanState, triggerHaptic } from "@/lib/can-system";

/** 游乐场：每日免费门票 + 喵喵积分 + 装扮解锁 */
export type SkinId = "bubble-caramel" | "river-shades" | "font-meow";

export type GameArcadeState = {
  /** 上次结算日期 YYYY-MM-DD */
  lastGameDate: string | null;
  /** 今日免费次数是否已用 */
  freePlayUsedToday: boolean;
  /** 喵喵积分（通关奖励，用于装扮兑换） */
  gamePoints: number;
  /** 已解锁皮肤 */
  unlockedSkins: SkinId[];
};

export type GameArcadeView = GameArcadeState & {
  /** 今日剩余免费次数（0 或 1） */
  freePlaysLeft: number;
};

export type ShopSkin = {
  id: SkinId;
  points: number;
  nameKey:
    | "game.shop.itemBubble"
    | "game.shop.itemShades"
    | "game.shop.itemFont";
  descKey:
    | "game.shop.descBubble"
    | "game.shop.descShades"
    | "game.shop.descFont";
};

const STORAGE_KEY = "cyberbookkeeper_game_arcade_v2";
export const GAME_ARCADE_EVENT = "game-arcade-updated";
export const FREE_PLAYS_PER_DAY = 1;
export const PLAY_CAN_COST = 1;
export const WIN_POINTS = 100;

const SKIN_IDS: SkinId[] = ["bubble-caramel", "river-shades", "font-meow"];

export const SHOP_PREVIEWS: readonly ShopSkin[] = [
  {
    id: "bubble-caramel",
    points: 300,
    nameKey: "game.shop.itemBubble",
    descKey: "game.shop.descBubble",
  },
  {
    id: "river-shades",
    points: 500,
    nameKey: "game.shop.itemShades",
    descKey: "game.shop.descShades",
  },
  {
    id: "font-meow",
    points: 800,
    nameKey: "game.shop.itemFont",
    descKey: "game.shop.descFont",
  },
] as const;

function isSkinId(v: unknown): v is SkinId {
  return typeof v === "string" && (SKIN_IDS as string[]).includes(v);
}

function defaultState(): GameArcadeState {
  return {
    lastGameDate: null,
    freePlayUsedToday: false,
    gamePoints: 0,
    unlockedSkins: [],
  };
}

function normalizeState(raw: unknown): GameArcadeState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  const unlocked = Array.isArray(row.unlockedSkins)
    ? row.unlockedSkins.filter(isSkinId)
    : [];
  return {
    lastGameDate:
      typeof row.lastGameDate === "string" && row.lastGameDate
        ? row.lastGameDate
        : null,
    freePlayUsedToday: Boolean(row.freePlayUsedToday),
    gamePoints: Math.max(0, Math.floor(Number(row.gamePoints) || 0)),
    unlockedSkins: unlocked,
  };
}

function writeRaw(state: GameArcadeState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(GAME_ARCADE_EVENT, { detail: state }));
}

function readRaw(): GameArcadeState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

function ensureTodayState(): GameArcadeState {
  const today = localDateString();
  const prev = readRaw();
  if (prev.lastGameDate === today) return prev;
  const next: GameArcadeState = {
    lastGameDate: today,
    freePlayUsedToday: false,
    gamePoints: prev.gamePoints,
    unlockedSkins: prev.unlockedSkins,
  };
  writeRaw(next);
  return next;
}

function toView(state: GameArcadeState): GameArcadeView {
  return {
    ...state,
    freePlaysLeft: state.freePlayUsedToday ? 0 : FREE_PLAYS_PER_DAY,
  };
}

export function readGameArcade(): GameArcadeView {
  return toView(ensureTodayState());
}

export function getShopSkin(id: SkinId): ShopSkin | undefined {
  return SHOP_PREVIEWS.find((s) => s.id === id);
}

/**
 * 开始一局：优先消耗免费门票；否则扣除 1 罐头。
 */
export function startArcadePlay(): {
  ok: boolean;
  paidWithCan: boolean;
  view: GameArcadeView;
  messageKey?: "game.arcade.buyNoCan";
} {
  const view = readGameArcade();
  const today = localDateString();

  if (view.freePlaysLeft > 0) {
    const next: GameArcadeState = {
      lastGameDate: today,
      freePlayUsedToday: true,
      gamePoints: view.gamePoints,
      unlockedSkins: view.unlockedSkins,
    };
    writeRaw(next);
    triggerHaptic();
    return { ok: true, paidWithCan: false, view: toView(next) };
  }

  const cans = readCanState();
  if (cans.cans_count < PLAY_CAN_COST) {
    return {
      ok: false,
      paidWithCan: false,
      view,
      messageKey: "game.arcade.buyNoCan",
    };
  }

  writeCanState({
    ...cans,
    cans_count: cans.cans_count - PLAY_CAN_COST,
  });
  triggerHaptic();
  return { ok: true, paidWithCan: true, view: readGameArcade() };
}

/** 通关发放喵喵积分 */
export function awardWinPoints(amount = WIN_POINTS): {
  pointsAdded: number;
  view: GameArcadeView;
} {
  const view = readGameArcade();
  const next: GameArcadeState = {
    lastGameDate: view.lastGameDate ?? localDateString(),
    freePlayUsedToday: view.freePlayUsedToday,
    gamePoints: view.gamePoints + amount,
    unlockedSkins: view.unlockedSkins,
  };
  writeRaw(next);
  triggerHaptic();
  return { pointsAdded: amount, view: toView(next) };
}

/** 用积分兑换皮肤 */
export function redeemSkin(id: SkinId): {
  ok: boolean;
  view: GameArcadeView;
  messageKey:
    | "game.shop.redeemOk"
    | "game.shop.alreadyOwned"
    | "game.shop.needMore";
  diff?: number;
} {
  const skin = getShopSkin(id);
  const view = readGameArcade();
  if (!skin) {
    return { ok: false, view, messageKey: "game.shop.needMore", diff: 0 };
  }
  if (view.unlockedSkins.includes(id)) {
    return { ok: false, view, messageKey: "game.shop.alreadyOwned" };
  }
  if (view.gamePoints < skin.points) {
    return {
      ok: false,
      view,
      messageKey: "game.shop.needMore",
      diff: skin.points - view.gamePoints,
    };
  }
  const next: GameArcadeState = {
    lastGameDate: view.lastGameDate ?? localDateString(),
    freePlayUsedToday: view.freePlayUsedToday,
    gamePoints: view.gamePoints - skin.points,
    unlockedSkins: [...view.unlockedSkins, id],
  };
  writeRaw(next);
  triggerHaptic();
  return { ok: true, view: toView(next), messageKey: "game.shop.redeemOk" };
}

export function clearGameArcadeLocal() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("cyberbookkeeper_game_arcade_v1");
  window.dispatchEvent(
    new CustomEvent(GAME_ARCADE_EVENT, { detail: defaultState() }),
  );
}
