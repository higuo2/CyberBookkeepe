import { localDateString } from "@/lib/transaction-utils";
import { readCanState, writeCanState, triggerHaptic } from "@/lib/can-system";

/** 游乐场：每日免费门票 + 喵喵积分 + 装扮解锁 */
export type SkinId = "bubble-caramel" | "river-shades" | "font-meow";

/**
 * 预留装扮槽位 ID（尚未上线）。
 * 正式上线时：并入 SkinId → 写入 SHOP_PREVIEWS → 从 SHOP_UPCOMING 移除。
 */
export type UpcomingSkinId =
  | "scarf-oat"
  | "bell-collar"
  | "frame-polaroid"
  | "tail-pompom"
  | "sticker-paw";

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

/** 装扮小铺「开发中」预告槽：便于未来接皮肤，不可兑换 */
export type UpcomingShopSkin = {
  id: UpcomingSkinId;
  /** 预估积分（仅展示） */
  pointsPreview: number;
  nameKey:
    | "game.shop.upcoming.scarf"
    | "game.shop.upcoming.bell"
    | "game.shop.upcoming.frame"
    | "game.shop.upcoming.tail"
    | "game.shop.upcoming.sticker";
  hintKey:
    | "game.shop.upcoming.scarfHint"
    | "game.shop.upcoming.bellHint"
    | "game.shop.upcoming.frameHint"
    | "game.shop.upcoming.tailHint"
    | "game.shop.upcoming.stickerHint";
};

const STORAGE_KEY = "cyberbookkeeper_game_arcade_v2";
export const GAME_ARCADE_EVENT = "game-arcade-updated";
export const FREE_PLAYS_PER_DAY = 1;
export const PLAY_CAN_COST = 1;
export const WIN_POINTS = 100;

const SKIN_IDS: SkinId[] = ["bubble-caramel", "river-shades", "font-meow"];

/** 已上线可兑换装扮（按此数组扩展正式皮肤） */
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

/**
 * 装扮预告槽（占位接口）。
 * 新增预告：往此数组 push 一项 + 补 i18n；上线时迁移到 SHOP_PREVIEWS。
 */
export const SHOP_UPCOMING: readonly UpcomingShopSkin[] = [
  {
    id: "scarf-oat",
    pointsPreview: 450,
    nameKey: "game.shop.upcoming.scarf",
    hintKey: "game.shop.upcoming.scarfHint",
  },
  {
    id: "bell-collar",
    pointsPreview: 600,
    nameKey: "game.shop.upcoming.bell",
    hintKey: "game.shop.upcoming.bellHint",
  },
  {
    id: "frame-polaroid",
    pointsPreview: 700,
    nameKey: "game.shop.upcoming.frame",
    hintKey: "game.shop.upcoming.frameHint",
  },
  {
    id: "tail-pompom",
    pointsPreview: 550,
    nameKey: "game.shop.upcoming.tail",
    hintKey: "game.shop.upcoming.tailHint",
  },
  {
    id: "sticker-paw",
    pointsPreview: 350,
    nameKey: "game.shop.upcoming.sticker",
    hintKey: "game.shop.upcoming.stickerHint",
  },
] as const;

export function getShopSkin(id: SkinId): ShopSkin | undefined {
  return SHOP_PREVIEWS.find((s) => s.id === id);
}

export function getUpcomingShopSkin(
  id: UpcomingSkinId,
): UpcomingShopSkin | undefined {
  return SHOP_UPCOMING.find((s) => s.id === id);
}

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

/** 扣除喵喵积分（装扮兑换等） */
export function spendGamePoints(amount: number): {
  ok: boolean;
  view: GameArcadeView;
  messageKey?: "game.shop.needMore";
} {
  const view = readGameArcade();
  const cost = Math.max(0, Math.floor(amount));
  if (view.gamePoints < cost) {
    return { ok: false, view, messageKey: "game.shop.needMore" };
  }
  const next: GameArcadeState = {
    lastGameDate: view.lastGameDate ?? localDateString(),
    freePlayUsedToday: view.freePlayUsedToday,
    gamePoints: view.gamePoints - cost,
    unlockedSkins: view.unlockedSkins,
  };
  writeRaw(next);
  triggerHaptic();
  return { ok: true, view: toView(next) };
}

/** 发放猫罐头 */
export function awardCans(amount: number): number {
  const cans = readCanState();
  const add = Math.max(0, Math.floor(amount));
  if (add <= 0) return 0;
  writeCanState({
    ...cans,
    cans_count: cans.cans_count + add,
  });
  triggerHaptic();
  return add;
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
