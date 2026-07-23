"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Gift, Heart, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import {
  SCRATCH_PAID_CANS,
  SCRATCH_REVEAL_RATIO,
  claimScratchReward,
  hasFreeScratchToday,
  refundScratchPaidCan,
  startScratchRound,
  type ScratchPrize,
} from "@/lib/scratch-card";
import { getAppCanvasFont } from "@/context/FontContext";

const W = 260;
const H = 130;
const BRUSH = 20;

function PrizeVisual({ prize, bounce }: { prize: ScratchPrize; bounce: boolean }) {
  const t = useT();
  const bounceClass = bounce ? "animate-bounce" : "";

  if (prize.id === "POINTS_50") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <Sparkles
          className={`size-9 text-amber-600 ${bounceClass}`}
          strokeWidth={2}
        />
        <p className="text-base font-bold text-[var(--color-text-main)]">
          {t(prize.titleKey)}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {t(prize.flavorKey)}
        </p>
      </div>
    );
  }
  if (prize.id === "WOOL") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className={`text-3xl leading-none ${bounceClass}`} aria-hidden>
          🧶
        </span>
        <p className="text-base font-bold text-[var(--color-text-main)]">
          {t(prize.titleKey)}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {t(prize.flavorKey)}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <CatCanIcon className={`size-9 text-amber-700 ${bounceClass}`} />
      <p className="text-base font-bold text-[var(--color-text-main)]">
        {t(prize.titleKey)}
      </p>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        {t(prize.flavorKey)}
      </p>
    </div>
  );
}

export function ScratchCardModal({
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
  const scratching = useRef(false);
  const claimed = useRef(false);
  const paidThisRound = useRef(false);
  const [prize, setPrize] = useState<ScratchPrize | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ready, setReady] = useState(false);
  const [isFreeTicket, setIsFreeTicket] = useState(true);

  const paintCover = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#D4B896");
    grad.addColorStop(0.5, "#C4A57A");
    grad.addColorStop(1, "#B8956A");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 0; i < 18; i++) {
      const x = (i * 47) % W;
      const y = (i * 31) % H;
      ctx.beginPath();
      ctx.arc(x, y, 6 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#5C4030";
    ctx.font = getAppCanvasFont(600, 13);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t("game.scratch.coverHint"), W / 2, H / 2);
  }, [t]);

  const beginRound = useCallback(
    (forcePaid = false) => {
      const result = startScratchRound({ forcePaid });
      if (!result.ok || !result.prize) {
        toast.error(t(result.messageKey ?? "game.scratch.needCans"));
        if (!prize) onOpenChange(false);
        onArcadeChange?.();
        return false;
      }
      claimed.current = false;
      paidThisRound.current = !result.usedFree;
      setPrize(result.prize);
      setRevealed(false);
      setReady(true);
      setIsFreeTicket(Boolean(result.usedFree));
      onArcadeChange?.();
      return true;
    },
    [onArcadeChange, onOpenChange, prize, t],
  );

  useEffect(() => {
    if (!open) {
      setPrize(null);
      setRevealed(false);
      setReady(false);
      claimed.current = false;
      paidThisRound.current = false;
      return;
    }
    setIsFreeTicket(hasFreeScratchToday());
    beginRound(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- only on open

  useEffect(() => {
    if (!open || !ready || !prize || revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    paintCover(canvas);
  }, [open, ready, prize, revealed, paintCover]);

  function eraseAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas || revealed || claimed.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, BRUSH, 0, Math.PI * 2);
    ctx.fill();
  }

  function scratchedRatio(): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let cleared = 0;
    const step = 4 * 8;
    for (let i = 3; i < data.length; i += step) {
      if (data[i] === 0) cleared += 1;
    }
    const samples = Math.ceil(data.length / step);
    return cleared / samples;
  }

  function finishReveal() {
    if (claimed.current || !prize) return;
    claimed.current = true;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setRevealed(true);
    claimScratchReward(prize);
    onArcadeChange?.();
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    scratching.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    eraseAt(e.clientX, e.clientY);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!scratching.current) return;
    eraseAt(e.clientX, e.clientY);
  }

  function onPointerUp() {
    if (!scratching.current) return;
    scratching.current = false;
    if (scratchedRatio() >= SCRATCH_REVEAL_RATIO) finishReveal();
  }

  function handleReplay() {
    beginRound(true);
  }

  function handleClose() {
    if (ready && !revealed && paidThisRound.current && !claimed.current) {
      refundScratchPaidCan();
      paidThisRound.current = false;
      onArcadeChange?.();
    }
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        className="w-full max-w-sm rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg-main)] p-4 shadow-xl"
        role="dialog"
        aria-modal
        aria-label={t("game.scratch.title")}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Gift className="size-4 shrink-0 text-amber-700" strokeWidth={2} />
            <p className="truncate text-sm font-bold text-[var(--color-text-main)]">
              {t("game.scratch.title")}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="grid size-7 place-items-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-soft)]"
            onClick={handleClose}
            type="button"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="relative mx-auto overflow-hidden rounded-2xl border border-[#EDE6DC] bg-gradient-to-br from-[#FFFDF9] to-[#F8F3EC] shadow-2xs"
          style={{ width: W, height: H }}
        >
          <div className="absolute inset-0 flex items-center justify-center px-3">
            {prize ? (
              <PrizeVisual bounce={revealed} prize={prize} />
            ) : (
              <Sparkles className="size-8 text-amber-600/50" strokeWidth={2} />
            )}
          </div>
          {!revealed && ready ? (
            <canvas
              className="absolute inset-0 z-10 touch-none cursor-crosshair rounded-2xl"
              height={H}
              onPointerCancel={onPointerUp}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              ref={canvasRef}
              width={W}
            />
          ) : null}
        </div>

        <p className="mt-2.5 text-center text-[11px] text-[var(--color-text-muted)]">
          {revealed
            ? t("game.scratch.revealedHint")
            : t("game.scratch.scratchHint")}
        </p>

        {revealed ? (
          <div className="mt-3 space-y-2">
            <button
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8C5D33] to-[#734722] py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-[#794E29] hover:to-[#633B1A] active:scale-[0.98]"
              onClick={handleClose}
              type="button"
            >
              <Heart
                className="size-3.5 fill-rose-300/30 text-rose-300"
                strokeWidth={2}
              />
              {t("game.scratch.keep")}
            </button>
            <button
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#D9C4B0] bg-[var(--color-bg-card)] py-2.5 text-xs font-semibold text-[#634225] shadow-2xs transition-all hover:bg-amber-50/50 active:scale-[0.98]"
              onClick={handleReplay}
              type="button"
            >
              <Sparkles className="size-3.5 text-amber-600" strokeWidth={2} />
              {t("game.scratch.replay", { n: SCRATCH_PAID_CANS })}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-[10px] text-[var(--color-text-muted)]">
            {isFreeTicket
              ? t("game.scratch.freeBadge")
              : t("game.scratch.paidBadge", { n: SCRATCH_PAID_CANS })}
          </p>
        )}
      </div>
    </div>
  );
}
