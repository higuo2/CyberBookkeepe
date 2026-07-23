"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Heart, Play, Sparkles, Target, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/LocaleProvider";
import {
  CATCH_DURATION_SEC,
  CATCH_FREEZE_SEC,
  CATCH_PAID_CANS,
  CATCH_RUSH_SEC,
  CATCH_TIER2,
  CATCH_TIER3,
  claimCatchReward,
  fallingStats,
  hasFreeCatchToday,
  resolveCatchReward,
  rollFallingKind,
  startCatchRound,
  type CatchReward,
  type FallingKind,
} from "@/lib/catch-game";
import { triggerHaptic } from "@/lib/can-system";
import { getAppCanvasFont } from "@/context/FontContext";

type Phase = "rules" | "playing" | "ended";

type Drop = {
  id: number;
  kind: FallingKind;
  x: number;
  y: number;
  speed: number;
};

type Floater = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

const W = 300;
const H = 320;
const BASKET_W = 64;
const BASKET_H = 22;
const BASKET_Y = H - 34;

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawFallingEmoji(
  ctx: CanvasRenderingContext2D,
  kind: FallingKind,
  x: number,
  y: number,
) {
  const emoji = kind === "can" ? "🥫" : kind === "fish" ? "🐟" : "🥒";
  const size = kind === "fish" ? 20 : kind === "cucumber" ? 22 : 24;
  ctx.save();
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, x, y);
  ctx.restore();
}

function drawBasket(
  ctx: CanvasRenderingContext2D,
  x: number,
  frozen: boolean,
  flash: number,
) {
  ctx.save();
  ctx.translate(x, BASKET_Y);
  if (frozen) {
    ctx.shadowColor = `rgba(220, 50, 50, ${0.35 + flash * 0.4})`;
    ctx.shadowBlur = 12;
  }
  // ears
  ctx.fillStyle = frozen ? "#E8B4B0" : "#F2E6D6";
  ctx.strokeStyle = frozen ? "#C47870" : "#D4C0A8";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-22, -2);
  ctx.lineTo(-28, -14);
  ctx.lineTo(-14, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(22, -2);
  ctx.lineTo(28, -14);
  ctx.lineTo(14, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // tray
  roundRectPath(ctx, -BASKET_W / 2, -4, BASKET_W, BASKET_H, 10);
  ctx.fillStyle = frozen ? "#F0D0CC" : "#FAF3EA";
  ctx.fill();
  ctx.strokeStyle = frozen ? "#C47870" : "#D9C4B0";
  ctx.stroke();
  // inner bowl
  roundRectPath(ctx, -BASKET_W / 2 + 6, 2, BASKET_W - 12, 10, 6);
  ctx.fillStyle = frozen ? "#E8C0BA" : "#F0E4D4";
  ctx.fill();
  ctx.restore();
}

export function CatchGameModal({
  open,
  onOpenChange,
  onArcadeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArcadeChange?: () => void;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetX = useRef(W / 2);
  const basketX = useRef(W / 2);
  const drops = useRef<Drop[]>([]);
  const floaters = useRef<Floater[]>([]);
  const particles = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const freezeUntil = useRef(0);
  const flashT = useRef(0);
  const spawnAcc = useRef(0);
  const nextId = useRef(1);
  const rafRef = useRef(0);
  const lastTs = useRef(0);
  const endAt = useRef(0);

  const [phase, setPhase] = useState<Phase>("rules");
  const [score, setScore] = useState(0);
  const [leftSec, setLeftSec] = useState(CATCH_DURATION_SEC);
  const [reward, setReward] = useState<CatchReward | null>(null);
  const [frozenUi, setFrozenUi] = useState(false);
  const [isFreeRound, setIsFreeRound] = useState(true);
  const claimedRef = useRef(false);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#FBF8F2");
    bg.addColorStop(1, "#F3EBE1");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (const d of drops.current) {
      drawFallingEmoji(ctx, d.kind, d.x, d.y);
    }

    const frozen = performance.now() < freezeUntil.current;
    drawBasket(ctx, basketX.current, frozen, flashT.current);

    for (const p of particles.current) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.font = getAppCanvasFont(600, 12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floaters.current) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }, []);

  const spawnFeedback = useCallback(
    (x: number, y: number, points: number) => {
      const id = nextId.current++;
      floaters.current.push({
        id,
        x,
        y,
        text: points > 0 ? `+${points}` : `${points}`,
        color: points > 0 ? "#B45309" : "#DC2626",
        life: 1,
      });
      const color = points > 0 ? "#E8B84A" : "#EF4444";
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
        particles.current.push({
          id: nextId.current++,
          x,
          y,
          vx: Math.cos(a) * (40 + Math.random() * 50),
          vy: Math.sin(a) * (40 + Math.random() * 50) - 20,
          life: 0.7 + Math.random() * 0.3,
          color,
        });
      }
    },
    [],
  );

  const finishGame = useCallback(() => {
    stopLoop();
    const finalScore = Math.max(0, scoreRef.current);
    setScore(finalScore);
    setLeftSec(0);
    setReward(resolveCatchReward(finalScore));
    setPhase("ended");
    setFrozenUi(false);
  }, [stopLoop]);

  const tick = useCallback(
    (ts: number) => {
      if (!lastTs.current) lastTs.current = ts;
      const dt = Math.min(0.05, (ts - lastTs.current) / 1000);
      lastTs.current = ts;

      const remainMs = endAt.current - ts;
      const sec = Math.max(0, Math.ceil(remainMs / 1000));
      setLeftSec(sec);
      if (remainMs <= 0) {
        finishGame();
        return;
      }

      const rush = remainMs <= CATCH_RUSH_SEC * 1000;
      const speedMul = rush ? 1.5 : 1;
      const spawnEvery = rush ? 0.55 / 1.5 : 0.55;

      const frozen = ts < freezeUntil.current;
      setFrozenUi(frozen);
      if (frozen) {
        flashT.current = (Math.sin(ts / 80) + 1) / 2;
      } else {
        flashT.current = 0;
        basketX.current += (targetX.current - basketX.current) * 0.25;
      }

      spawnAcc.current += dt;
      while (spawnAcc.current >= spawnEvery) {
        spawnAcc.current -= spawnEvery;
        const kind = rollFallingKind();
        const stats = fallingStats(kind);
        const speed =
          (stats.speedMin + Math.random() * (stats.speedMax - stats.speedMin)) *
          speedMul;
        drops.current.push({
          id: nextId.current++,
          kind,
          x: 28 + Math.random() * (W - 56),
          y: -24,
          speed,
        });
      }

      const bx = basketX.current;
      const next: Drop[] = [];
      for (const d of drops.current) {
        d.y += d.speed * dt;
        const stats = fallingStats(d.kind);
        const hit =
          d.y >= BASKET_Y - 12 &&
          d.y <= BASKET_Y + BASKET_H &&
          Math.abs(d.x - bx) < BASKET_W / 2 - 4 + stats.hitRadius * 0.15;
        const tightHit =
          d.kind === "fish"
            ? Math.abs(d.x - bx) < stats.hitRadius + 6
            : Math.abs(d.x - bx) < BASKET_W / 2 - 2;

        if (hit && tightHit) {
          scoreRef.current = Math.max(0, scoreRef.current + stats.points);
          setScore(scoreRef.current);
          spawnFeedback(d.x, d.y, stats.points);
          if (d.kind === "cucumber") {
            freezeUntil.current = ts + CATCH_FREEZE_SEC * 1000;
            triggerHaptic();
          }
          continue;
        }
        if (d.y < H + 40) next.push(d);
      }
      drops.current = next;

      floaters.current = floaters.current
        .map((f) => ({
          ...f,
          y: f.y - 36 * dt,
          life: f.life - dt * 1.2,
        }))
        .filter((f) => f.life > 0);

      particles.current = particles.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vy: p.vy + 80 * dt,
          life: p.life - dt * 1.6,
        }))
        .filter((p) => p.life > 0);

      paint();
      rafRef.current = requestAnimationFrame(tick);
    },
    [finishGame, paint, spawnFeedback],
  );

  const beginPlay = useCallback(() => {
    const started = startCatchRound();
    if (!started.ok) {
      toast.error(t(started.messageKey ?? "game.catch.needCost"));
      onArcadeChange?.();
      onOpenChange(false);
      return;
    }
    claimedRef.current = false;
    setIsFreeRound(Boolean(started.usedFree));
    onArcadeChange?.();
    drops.current = [];
    floaters.current = [];
    particles.current = [];
    scoreRef.current = 0;
    freezeUntil.current = 0;
    flashT.current = 0;
    spawnAcc.current = 0;
    nextId.current = 1;
    targetX.current = W / 2;
    basketX.current = W / 2;
    setScore(0);
    setReward(null);
    setFrozenUi(false);
    setLeftSec(CATCH_DURATION_SEC);
    setPhase("playing");
    lastTs.current = 0;
    endAt.current = performance.now() + CATCH_DURATION_SEC * 1000;
    stopLoop();
    rafRef.current = requestAnimationFrame(tick);
  }, [onArcadeChange, onOpenChange, stopLoop, t, tick]);

  useEffect(() => {
    if (!open) {
      stopLoop();
      setPhase("rules");
      setScore(0);
      setReward(null);
      setFrozenUi(false);
      setLeftSec(CATCH_DURATION_SEC);
      claimedRef.current = false;
      return;
    }
    setPhase("rules");
    setScore(0);
    setReward(null);
    setFrozenUi(false);
    setLeftSec(CATCH_DURATION_SEC);
    claimedRef.current = false;
    setIsFreeRound(hasFreeCatchToday());
    return () => stopLoop();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === "playing") paint();
  }, [phase, paint]);

  function moveTarget(clientX: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (performance.now() < freezeUntil.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    targetX.current = Math.max(BASKET_W / 2, Math.min(W - BASKET_W / 2, x));
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (phase !== "playing") return;
    moveTarget(e.clientX);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (phase !== "playing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTarget(e.clientX);
  }

  function settleReward(showToast: boolean) {
    if (claimedRef.current) return;
    claimedRef.current = true;
    const result = claimCatchReward(scoreRef.current);
    setReward(result.reward);
    onArcadeChange?.();
    if (showToast) {
      toast.success(
        t("game.catch.rewardToast", {
          cans: result.reward.cans,
          points: result.reward.points,
        }),
      );
    }
  }

  function handleClaim() {
    settleReward(true);
    onOpenChange(false);
  }

  function handleClose() {
    stopLoop();
    if (phase === "ended") {
      settleReward(false);
    }
    onOpenChange(false);
  }

  if (!open) return null;

  const preview = reward ?? resolveCatchReward(score);

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        aria-label={t("game.catch.title")}
        aria-modal
        className="w-full max-w-sm rounded-3xl border border-[#EDE6DC] bg-[#FAF7F2] p-5 shadow-xl"
        role="dialog"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-stone-800">
            {phase === "rules" ? t("game.catch.rulesTitle") : t("game.catch.title")}
          </p>
          <button
            aria-label={t("common.close")}
            className="grid size-7 place-items-center rounded-full text-stone-400 hover:bg-stone-200/50"
            onClick={handleClose}
            type="button"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>

        {phase === "rules" ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3 text-xs font-medium text-[#634225]">
              <span className="shrink-0">
                ⏱️ {t("game.catch.summaryTime", { n: CATCH_DURATION_SEC })}
              </span>
              <span className="min-w-0 truncate text-right">
                👈 {t("game.catch.summarySwipe")} 👉
              </span>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-stone-800">
                  🥫 {t("game.catch.itemCan")}
                </p>
                <p className="mt-1 text-xs font-bold tabular-nums text-amber-600">
                  {t("game.catch.scoreCan")}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-stone-800">
                  🐟 {t("game.catch.itemFish")}
                </p>
                <p className="mt-1 text-xs font-bold tabular-nums text-amber-600">
                  {t("game.catch.scoreFish")}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-rose-800">
                  🥒 {t("game.catch.itemCucumber")}
                </p>
                <p className="mt-1 text-xs font-semibold tabular-nums text-rose-600">
                  {t("game.catch.scoreCucumber")}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-xs font-bold text-stone-700">
                🏆 {t("game.catch.rewardsTitle")}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs text-stone-600">
                  <span className="min-w-0 truncate">
                    🥉 {t("game.catch.tier1Label", { a: CATCH_TIER2 })}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    ✨ {t("game.catch.tier1Reward")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-stone-700">
                  <span className="min-w-0 truncate">
                    🥈{" "}
                    {t("game.catch.tier2Label", {
                      a: CATCH_TIER2,
                      b: CATCH_TIER3 - 1,
                    })}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    ✨ {t("game.catch.tier2Reward")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs font-bold text-amber-900">
                  <span className="min-w-0 truncate">
                    🥇 {t("game.catch.tier3Label", { a: CATCH_TIER3 })}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    🥫 {t("game.catch.tier3Reward")}
                  </span>
                </div>
              </div>
            </div>

            <p className="mb-3 text-center text-[11px] text-stone-500">
              🎟️{" "}
              {isFreeRound
                ? t("game.catch.costBadgeFree")
                : t("game.catch.costBadgePaid", { n: CATCH_PAID_CANS })}
            </p>

            <button
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#8C5D33] to-[#734722] py-3 text-sm font-bold text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.98]"
              onClick={beginPlay}
              type="button"
            >
              <Play className="size-4 fill-white/30" strokeWidth={2} />
              {t("game.catch.startPlay")}
            </button>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-amber-900/80">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EFE6] px-2 py-1">
                <Timer className="size-3 text-amber-700" strokeWidth={2} />
                {leftSec}s
                {leftSec <= CATCH_RUSH_SEC && phase === "playing" ? (
                  <span className="text-rose-600">{t("game.catch.rush")}</span>
                ) : null}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EFE6] px-2 py-1">
                <Target className="size-3 text-amber-700" strokeWidth={2} />
                {t("game.catch.score", { n: score })}
              </span>
            </div>

            {frozenUi && phase === "playing" ? (
              <p className="mb-2 text-center text-[11px] font-medium text-rose-600">
                {t("game.catch.frozen")}
              </p>
            ) : null}

            <div className="relative mx-auto overflow-hidden rounded-2xl border border-[#EDE6DC] shadow-2xs">
              <canvas
                className="block touch-none cursor-pointer"
                height={H}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                ref={canvasRef}
                width={W}
              />

              {phase === "ended" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[#FAF7F2]/94 p-4 backdrop-blur-[2px]">
                  <div className="w-full rounded-2xl border border-[#EDE6DC] bg-white p-4 text-center shadow-sm">
                    <p className="text-base font-bold text-stone-800">
                      {t(preview.titleKey)}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
                      {t(preview.messageKey)}
                    </p>
                    <p className="mt-2 font-numeric text-sm font-semibold text-amber-800">
                      {t("game.catch.finalScore", { n: score })}
                    </p>
                    <p className="mt-1 flex items-center justify-center gap-2 text-[11px] text-stone-500">
                      {preview.cans > 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          🥫×{preview.cans}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-0.5">
                        <Sparkles
                          className="size-3 text-amber-600"
                          strokeWidth={2}
                        />
                        +{preview.points}
                      </span>
                    </p>
                    <button
                      className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8C5D33] to-[#734722] py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-[#794E29] hover:to-[#633B1A] active:scale-[0.98]"
                      onClick={handleClaim}
                      type="button"
                    >
                      <Heart
                        className="size-3.5 fill-rose-300/30 text-rose-300"
                        strokeWidth={2}
                      />
                      {t("game.catch.claim")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {phase === "playing" ? (
              <p className="mt-2.5 text-center text-[11px] text-stone-400">
                {t("game.catch.playHint")}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
