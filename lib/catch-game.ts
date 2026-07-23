import { localDateString } from "@/lib/transaction-utils";
import {
  awardCans,
  awardWinPoints,
  readGameArcade,
  type GameArcadeView,
} from "@/lib/game-arcade";
import { readCanState, writeCanState, triggerHaptic } from "@/lib/can-system";

const CATCH_DATE_KEY = "last_catch_date";
export const CATCH_DURATION_SEC = 15;
export const CATCH_RUSH_SEC = 5;
export const CATCH_FREEZE_SEC = 1.2;
/** 付费局消耗罐头数 */
export const CATCH_PAID_CANS = 1;
export const CATCH_TIER2 = 80;
export const CATCH_TIER3 = 150;

export type CatchTier = 1 | 2 | 3;

export type CatchReward = {
  tier: CatchTier;
  cans: number;
  points: number;
  titleKey:
    | "game.catch.tier1Title"
    | "game.catch.tier2Title"
    | "game.catch.tier3Title";
  messageKey:
    | "game.catch.tier1Body"
    | "game.catch.tier2Body"
    | "game.catch.tier3Body";
};

export function hasFreeCatchToday(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(CATCH_DATE_KEY) !== localDateString();
  } catch {
    return true;
  }
}

export function markCatchUsedToday() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATCH_DATE_KEY, localDateString());
  } catch {
    // ignore
  }
}

/**
 * 开始接接乐：优先免费（开局即消耗免费次数）；否则扣 1 罐头。
 */
export function startCatchRound(): {
  ok: boolean;
  usedFree?: boolean;
  view?: GameArcadeView;
  messageKey?: "game.catch.needCost";
} {
  if (hasFreeCatchToday()) {
    markCatchUsedToday();
    return { ok: true, usedFree: true, view: readGameArcade() };
  }

  const cans = readCanState();
  if (cans.cans_count >= CATCH_PAID_CANS) {
    writeCanState({
      ...cans,
      cans_count: cans.cans_count - CATCH_PAID_CANS,
    });
    triggerHaptic();
    return { ok: true, usedFree: false, view: readGameArcade() };
  }

  return {
    ok: false,
    view: readGameArcade(),
    messageKey: "game.catch.needCost",
  };
}

export function resolveCatchReward(score: number): CatchReward {
  if (score >= CATCH_TIER3) {
    return {
      tier: 3,
      cans: 1,
      points: 50,
      titleKey: "game.catch.tier3Title",
      messageKey: "game.catch.tier3Body",
    };
  }
  if (score >= CATCH_TIER2) {
    return {
      tier: 2,
      cans: 0,
      points: 40,
      titleKey: "game.catch.tier2Title",
      messageKey: "game.catch.tier2Body",
    };
  }
  return {
    tier: 1,
    cans: 0,
    points: 15,
    titleKey: "game.catch.tier1Title",
    messageKey: "game.catch.tier1Body",
  };
}

export function claimCatchReward(score: number): {
  reward: CatchReward;
  view: GameArcadeView;
} {
  const reward = resolveCatchReward(score);
  if (reward.cans > 0) awardCans(reward.cans);
  let view = readGameArcade();
  if (reward.points > 0) {
    view = awardWinPoints(reward.points).view;
  }
  return { reward, view };
}

export type FallingKind = "can" | "fish" | "cucumber";

export function rollFallingKind(): FallingKind {
  const r = Math.random() * 100;
  if (r < 60) return "can";
  if (r < 85) return "fish";
  return "cucumber";
}

export function fallingStats(kind: FallingKind): {
  points: number;
  speedMin: number;
  speedMax: number;
  hitRadius: number;
} {
  if (kind === "fish") {
    return { points: 25, speedMin: 200, speedMax: 280, hitRadius: 12 };
  }
  if (kind === "cucumber") {
    return { points: -20, speedMin: 130, speedMax: 180, hitRadius: 16 };
  }
  return { points: 10, speedMin: 95, speedMax: 145, hitRadius: 18 };
}
