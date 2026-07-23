"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Coins,
  Fish,
  Heart,
  PawPrint,
  Sparkles,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { CatAvatar } from "@/components/CatAvatar";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import {
  awardWinPoints,
  startArcadePlay,
  WIN_POINTS,
} from "@/lib/game-arcade";

const ROUND_SECONDS = 25;
const FLIP_LOCK_MS = 800;

type PairId = "can" | "fish" | "paw" | "coins" | "sparkles" | "heart";

type FlipCard = {
  uid: string;
  pairId: PairId;
  flipped: boolean;
  matched: boolean;
};

type Phase = "playing" | "won" | "lost";

const PAIR_IDS: PairId[] = [
  "can",
  "fish",
  "paw",
  "coins",
  "sparkles",
  "heart",
];

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function buildDeck(): FlipCard[] {
  const deck: FlipCard[] = [];
  for (const pairId of PAIR_IDS) {
    deck.push(
      { uid: `${pairId}-a`, pairId, flipped: false, matched: false },
      { uid: `${pairId}-b`, pairId, flipped: false, matched: false },
    );
  }
  return shuffle(deck);
}

function PairIcon({
  pairId,
  className = "size-6",
}: {
  pairId: PairId;
  className?: string;
}) {
  const common = { className, strokeWidth: 2 as const };
  switch (pairId) {
    case "can":
      return <CatCanIcon className={className} />;
    case "fish":
      return <Fish {...common} />;
    case "paw":
      return <PawPrint {...common} />;
    case "coins":
      return <Coins {...common} />;
    case "sparkles":
      return <Sparkles {...common} />;
    case "heart":
      return <Heart {...common} />;
  }
}

export function FlipCardGame({
  onExit,
  onArcadeChange,
}: {
  onExit: () => void;
  onArcadeChange?: () => void;
}) {
  const t = useT();
  const [cards, setCards] = useState<FlipCard[]>(() => buildDeck());
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>("playing");
  const [picked, setPicked] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const awardedRef = useRef(false);
  const tickRef = useRef<number | null>(null);
  const lockTimerRef = useRef<number | null>(null);

  const matchedCount = useMemo(
    () => cards.filter((c) => c.matched).length / 2,
    [cards],
  );

  const clearTimers = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (lockTimerRef.current != null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  const startRound = useCallback(() => {
    clearTimers();
    awardedRef.current = false;
    setCards(buildDeck());
    setSecondsLeft(ROUND_SECONDS);
    setPhase("playing");
    setPicked([]);
    setLocked(false);
    setPointsAwarded(0);
  }, [clearTimers]);

  useEffect(() => {
    startRound();
    return () => clearTimers();
  }, [startRound, clearTimers]);

  useEffect(() => {
    if (phase !== "playing") {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (tickRef.current != null) {
            window.clearInterval(tickRef.current);
            tickRef.current = null;
          }
          setPhase((p) => (p === "playing" ? "lost" : p));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (matchedCount < PAIR_IDS.length) return;
    clearTimers();
    setPhase("won");
    if (!awardedRef.current) {
      awardedRef.current = true;
      const result = awardWinPoints(WIN_POINTS);
      setPointsAwarded(result.pointsAdded);
      onArcadeChange?.();
      toast.success(t("game.flip.pointsOk", { n: result.pointsAdded }));
    }
  }, [matchedCount, phase, clearTimers, onArcadeChange, t]);

  function flipCard(uid: string) {
    if (phase !== "playing" || locked) return;
    const card = cards.find((c) => c.uid === uid);
    if (!card || card.flipped || card.matched) return;
    if (picked.length >= 2) return;

    const nextPicked = [...picked, uid];
    setCards((prev) =>
      prev.map((c) => (c.uid === uid ? { ...c, flipped: true } : c)),
    );
    setPicked(nextPicked);

    if (nextPicked.length < 2) return;

    setLocked(true);
    const [a, b] = nextPicked as [string, string];
    const pairA = cards.find((c) => c.uid === a)?.pairId;
    const pairB = card.pairId;

    lockTimerRef.current = window.setTimeout(() => {
      const match = pairA != null && pairA === pairB && a !== b;

      setCards((prev) =>
        prev.map((c) => {
          if (c.uid !== a && c.uid !== b) return c;
          if (match) return { ...c, flipped: true, matched: true };
          return { ...c, flipped: false, matched: false };
        }),
      );
      setPicked([]);
      setLocked(false);
      lockTimerRef.current = null;
    }, FLIP_LOCK_MS);
  }

  function handleReplay() {
    const result = startArcadePlay();
    onArcadeChange?.();
    if (!result.ok) {
      toast.error(t(result.messageKey ?? "game.arcade.buyNoCan"));
      onExit();
      return;
    }
    startRound();
  }

  let overlay: ReactNode = null;
  if (phase === "won") {
    overlay = (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FDFBF7]/92 px-4 backdrop-blur-[2px]">
        <div className="w-full max-w-sm rounded-2xl border border-amber-200/70 bg-white p-5 text-center shadow-lg">
          <CatAvatar className="mx-auto size-14" size={56} />
          <p className="mt-3 text-base font-bold text-stone-800">
            {t("game.flip.winTitle")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
            {t("game.flip.winBody")}
          </p>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-900">
            <Sparkles className="size-3.5 text-amber-600" strokeWidth={2} />
            {t("game.flip.pointsGain", { n: pointsAwarded || WIN_POINTS })}
          </p>
          <div className="mt-4 space-y-2">
            <button
              className="w-full rounded-xl border border-stone-200/80 bg-white py-2.5 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 active:scale-[0.98]"
              onClick={handleReplay}
              type="button"
            >
              {t("game.flip.replay")}
            </button>
            <button
              className="w-full py-2 text-xs font-medium text-stone-400 transition-colors hover:text-stone-600"
              onClick={onExit}
              type="button"
            >
              {t("game.flip.back")}
            </button>
          </div>
        </div>
      </div>
    );
  } else if (phase === "lost") {
    overlay = (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FDFBF7]/92 px-4 backdrop-blur-[2px]">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200/70 bg-white p-5 text-center shadow-lg">
          <CatAvatar className="mx-auto size-14" size={56} />
          <p className="mt-3 text-base font-bold text-stone-800">
            {t("game.flip.loseTitle")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
            {t("game.flip.loseBody")}
          </p>
          <div className="mt-4 space-y-2">
            <button
              className="w-full rounded-xl bg-amber-200/80 py-3 text-sm font-medium text-amber-950 shadow-xs transition-all hover:bg-amber-300/80 active:scale-[0.98]"
              onClick={handleReplay}
              type="button"
            >
              {t("game.flip.replay")}
            </button>
            <button
              className="w-full py-2 text-xs font-medium text-stone-400 transition-colors hover:text-stone-600"
              onClick={onExit}
              type="button"
            >
              {t("game.flip.back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-800">
          {t("game.flip.title")}
        </p>
        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100/70 px-2 py-1 text-xs font-medium text-amber-900">
          <Timer className="size-3.5" strokeWidth={2} />
          {secondsLeft}s
        </span>
      </div>

      <div className="relative grid grid-cols-4 gap-2.5">
        {cards.map((card) => {
          const showFace = card.flipped || card.matched;
          return (
            <button
              aria-label={t("game.flip.cardAria")}
              className={`relative h-16 [perspective:600px] ${
                locked && !card.flipped && !card.matched
                  ? "pointer-events-none"
                  : ""
              }`}
              disabled={phase !== "playing" || locked || card.matched}
              key={card.uid}
              onClick={() => flipCard(card.uid)}
              type="button"
            >
              <span
                className={`relative block h-full w-full transition-transform duration-200 [transform-style:preserve-3d] ${
                  showFace ? "[transform:rotateY(180deg)]" : ""
                }`}
              >
                <span className="absolute inset-0 flex items-center justify-center rounded-xl border border-amber-200/80 bg-amber-100/60 text-amber-700/35 [backface-visibility:hidden] transition-all hover:bg-amber-200/50">
                  <CatCanIcon className="size-4 opacity-40" />
                </span>
                <span
                  className={`absolute inset-0 flex items-center justify-center rounded-xl border bg-white shadow-xs [transform:rotateY(180deg)] [backface-visibility:hidden] ${
                    card.matched
                      ? "border-amber-400/80 text-amber-700"
                      : "border-stone-200/80 text-stone-700"
                  }`}
                >
                  <PairIcon pairId={card.pairId} />
                </span>
              </span>
            </button>
          );
        })}
        {overlay}
      </div>
    </div>
  );
}
