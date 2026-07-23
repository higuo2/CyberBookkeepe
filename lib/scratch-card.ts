import { localDateString } from "@/lib/transaction-utils";
import {
  awardCans,
  awardWinPoints,
  readGameArcade,
  type GameArcadeView,
} from "@/lib/game-arcade";
import { readCanState, writeCanState, triggerHaptic } from "@/lib/can-system";

export type ScratchPrizeId = "CAN_1" | "POINTS_50" | "CAN_2" | "WOOL";

export type ScratchPrize = {
  id: ScratchPrizeId;
  cans: number;
  points: number;
  titleKey:
    | "game.scratch.prize.can1"
    | "game.scratch.prize.points50"
    | "game.scratch.prize.can2"
    | "game.scratch.prize.wool";
  flavorKey:
    | "game.scratch.flavor.can1"
    | "game.scratch.flavor.points50"
    | "game.scratch.flavor.can2"
    | "game.scratch.flavor.wool";
};

const SCRATCH_DATE_KEY = "last_scratch_date";
/** 付费局消耗罐头数 */
export const SCRATCH_PAID_CANS = 1;
export const SCRATCH_REVEAL_RATIO = 0.4;

const WEIGHTED: { id: ScratchPrizeId; weight: number }[] = [
  { id: "CAN_1", weight: 50 },
  { id: "POINTS_50", weight: 30 },
  { id: "CAN_2", weight: 10 },
  { id: "WOOL", weight: 10 },
];

const PRIZES: Record<ScratchPrizeId, ScratchPrize> = {
  CAN_1: {
    id: "CAN_1",
    cans: 1,
    points: 0,
    titleKey: "game.scratch.prize.can1",
    flavorKey: "game.scratch.flavor.can1",
  },
  POINTS_50: {
    id: "POINTS_50",
    cans: 0,
    points: 50,
    titleKey: "game.scratch.prize.points50",
    flavorKey: "game.scratch.flavor.points50",
  },
  CAN_2: {
    id: "CAN_2",
    cans: 2,
    points: 0,
    titleKey: "game.scratch.prize.can2",
    flavorKey: "game.scratch.flavor.can2",
  },
  WOOL: {
    id: "WOOL",
    cans: 0,
    points: 0,
    titleKey: "game.scratch.prize.wool",
    flavorKey: "game.scratch.flavor.wool",
  },
};

export function getScratchPrize(id: ScratchPrizeId): ScratchPrize {
  return PRIZES[id];
}

/** 加权随机抽奖（客户端离线） */
export function rollScratchPrize(): ScratchPrize {
  const total = WEIGHTED.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const item of WEIGHTED) {
    r -= item.weight;
    if (r <= 0) return PRIZES[item.id];
  }
  return PRIZES.CAN_1;
}

export function hasFreeScratchToday(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SCRATCH_DATE_KEY) !== localDateString();
  } catch {
    return true;
  }
}

export function markScratchUsedToday() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SCRATCH_DATE_KEY, localDateString());
  } catch {
    // ignore
  }
}

/**
 * 开始一局刮刮乐：优先免费（开局即消耗免费次数）；否则扣 1 罐头。
 * 成功后返回新奖品（尚未结算）。
 */
export function startScratchRound(options?: {
  forcePaid?: boolean;
}): {
  ok: boolean;
  prize?: ScratchPrize;
  usedFree?: boolean;
  view?: GameArcadeView;
  messageKey?: "game.scratch.needCans";
} {
  const free = hasFreeScratchToday() && !options?.forcePaid;
  if (free) {
    markScratchUsedToday();
    return { ok: true, prize: rollScratchPrize(), usedFree: true };
  }

  const cans = readCanState();
  if (cans.cans_count < SCRATCH_PAID_CANS) {
    return {
      ok: false,
      view: readGameArcade(),
      messageKey: "game.scratch.needCans",
    };
  }

  writeCanState({
    ...cans,
    cans_count: cans.cans_count - SCRATCH_PAID_CANS,
  });
  triggerHaptic();

  return {
    ok: true,
    prize: rollScratchPrize(),
    usedFree: false,
    view: readGameArcade(),
  };
}

/** 付费局未揭晓就关闭时退回罐头 */
export function refundScratchPaidCan(): number {
  return awardCans(SCRATCH_PAID_CANS);
}

/** 刮开后结算奖励（免费次数已在开局标记） */
export function claimScratchReward(prize: ScratchPrize): {
  cansAdded: number;
  pointsAdded: number;
  view: GameArcadeView;
} {
  let cansAdded = 0;
  let pointsAdded = 0;
  if (prize.cans > 0) cansAdded = awardCans(prize.cans);
  let view = readGameArcade();
  if (prize.points > 0) {
    const awarded = awardWinPoints(prize.points);
    pointsAdded = awarded.pointsAdded;
    view = awarded.view;
  }
  return { cansAdded, pointsAdded, view };
}
