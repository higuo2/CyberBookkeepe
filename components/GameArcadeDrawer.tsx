"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Gift,
  Glasses,
  HelpCircle,
  Lock,
  Palette,
  Sparkles,
  Target,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { FlipCardGame } from "@/components/FlipCardGame";
import { CatAvatar } from "@/components/CatAvatar";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import {
  FREE_PLAYS_PER_DAY,
  GAME_ARCADE_EVENT,
  PLAY_CAN_COST,
  SHOP_PREVIEWS,
  WIN_POINTS,
  readGameArcade,
  redeemSkin,
  startArcadePlay,
  type GameArcadeView,
  type ShopSkin,
} from "@/lib/game-arcade";
import { CAN_STATE_EVENT, readCanState } from "@/lib/can-system";

type View = "list" | "flip" | "shop";

export function GameArcadeDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [arcade, setArcade] = useState<GameArcadeView>(() => readGameArcade());
  const [cans, setCans] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [previewSkin, setPreviewSkin] = useState<ShopSkin | null>(null);
  const rulesRef = useRef<HTMLDivElement>(null);

  function refresh() {
    setArcade(readGameArcade());
    setCans(readCanState().cans_count);
  }

  useEffect(() => {
    if (!open) return;
    setView("list");
    setRulesOpen(false);
    setPreviewSkin(null);
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener(GAME_ARCADE_EVENT, onUpdate);
    window.addEventListener(CAN_STATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener(GAME_ARCADE_EVENT, onUpdate);
      window.removeEventListener(CAN_STATE_EVENT, onUpdate);
    };
  }, [open]);

  useEffect(() => {
    if (!rulesOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (rulesRef.current && target && !rulesRef.current.contains(target)) {
        setRulesOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [rulesOpen]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setView("list");
      setRulesOpen(false);
      setPreviewSkin(null);
    }
    onOpenChange(next);
  }

  function startFlip() {
    if (arcade.freePlaysLeft <= 0 && cans < PLAY_CAN_COST) {
      toast.error(t("game.arcade.buyNoCan"));
      return;
    }
    const result = startArcadePlay();
    refresh();
    if (!result.ok) {
      toast.error(t(result.messageKey ?? "game.arcade.buyNoCan"));
      return;
    }
    setView("flip");
  }

  function navigateToQuickAdd() {
    handleOpenChange(false);
    window.setTimeout(() => router.push("/"), 180);
  }

  function handleRedeem() {
    if (!previewSkin) return;
    const result = redeemSkin(previewSkin.id);
    refresh();
    if (!result.ok) {
      if (result.messageKey === "game.shop.needMore") {
        toast.error(
          t("game.shop.needMoreToast", { n: result.diff ?? previewSkin.points }),
        );
      } else {
        toast.message(t(result.messageKey));
      }
      return;
    }
    toast.success(t(result.messageKey));
    setPreviewSkin(null);
  }

  const freeLeft = arcade.freePlaysLeft;
  const canAfford = cans >= PLAY_CAN_COST;
  let startLabel = t("game.arcade.startFree");
  let startDisabled = false;
  const ticketClass =
    "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-[#E0D6C8] bg-[#EDE6DC] px-3 text-xs font-medium leading-none text-[#6B5E52] shadow-2xs transition-all hover:bg-[#E5DDD2] hover:text-[#5A4E44] active:scale-[0.98] disabled:cursor-not-allowed disabled:border-stone-200/70 disabled:bg-stone-100 disabled:text-stone-400 disabled:hover:bg-stone-100";

  if (freeLeft <= 0) {
    if (canAfford) {
      startLabel = t("game.arcade.startPaid", { cost: PLAY_CAN_COST });
    } else {
      startLabel = t("game.arcade.startNoCan");
      startDisabled = true;
    }
  }

  const owned =
    previewSkin != null &&
    arcade.unlockedSkins.includes(previewSkin.id);
  const canRedeem =
    previewSkin != null &&
    !owned &&
    arcade.gamePoints >= previewSkin.points;
  const pointsDiff =
    previewSkin != null
      ? Math.max(0, previewSkin.points - arcade.gamePoints)
      : 0;

  return (
    <Drawer.Root direction="left" onOpenChange={handleOpenChange} open={open}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px]" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-[90] flex h-full w-[min(360px,92vw)] flex-col bg-[#FDFBF7] outline-none shadow-2xl"
        >
          <Drawer.Title className="sr-only">{t("game.arcade.title")}</Drawer.Title>

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/50 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-2">
              <Gamepad2
                className="size-5 shrink-0 text-amber-600"
                strokeWidth={2}
              />
              <p className="truncate text-base font-bold text-stone-800">
                {t("game.arcade.title")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="relative" ref={rulesRef}>
                <button
                  aria-expanded={rulesOpen}
                  aria-label={t("game.rules.title")}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E8DFC2] bg-[#F5EFE6] px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-[#EFE8DC]"
                  onClick={() => setRulesOpen((v) => !v)}
                  type="button"
                >
                  <span className="flex items-center gap-1">
                    <CatCanIcon className="size-3.5 shrink-0 text-amber-700" />
                    <span className="leading-none">
                      {t("game.arcade.cansShort", { cans })}
                    </span>
                  </span>
                  <span aria-hidden className="leading-none text-stone-300">
                    |
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles
                      className="size-3.5 shrink-0 text-amber-600"
                      strokeWidth={2}
                    />
                    <span className="leading-none">
                      {t("game.arcade.pointsShort", { n: arcade.gamePoints })}
                    </span>
                  </span>
                  <HelpCircle
                    className="ml-0.5 size-3.5 shrink-0 text-stone-400 transition-colors hover:text-stone-600"
                    strokeWidth={2}
                  />
                </button>

                {rulesOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[min(280px,78vw)] rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-lg">
                    <p className="text-xs font-semibold text-stone-800">
                      {t("game.rules.title")}
                    </p>
                    <ul className="mt-2.5 space-y-2.5">
                      <li className="flex gap-2 text-[11px] leading-relaxed text-stone-500">
                        <CatCanIcon className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                        <span>
                          <span className="font-medium text-stone-700">
                            {t("game.rules.canTitle")}
                          </span>
                          {t("game.rules.canBody")}
                        </span>
                      </li>
                      <li className="flex gap-2 text-[11px] leading-relaxed text-stone-500">
                        <Sparkles
                          className="mt-0.5 size-3.5 shrink-0 text-amber-600"
                          strokeWidth={2}
                        />
                        <span>
                          <span className="font-medium text-stone-700">
                            {t("game.rules.pointsTitle")}
                          </span>
                          {t("game.rules.pointsBody", { n: WIN_POINTS })}
                        </span>
                      </li>
                      <li className="flex gap-2 text-[11px] leading-relaxed text-stone-500">
                        <Target
                          className="mt-0.5 size-3.5 shrink-0 text-amber-600"
                          strokeWidth={2}
                        />
                        <span>
                          <span className="font-medium text-stone-700">
                            {t("game.rules.freeTitle")}
                          </span>
                          {t("game.rules.freeBody", {
                            n: FREE_PLAYS_PER_DAY,
                          })}
                        </span>
                      </li>
                    </ul>
                  </div>
                ) : null}
              </div>

              <button
                aria-label={t("common.close")}
                className="grid size-8 shrink-0 place-items-center rounded-full text-stone-400 transition-colors hover:bg-stone-200/50 hover:text-stone-600 active:scale-95"
                onClick={() => handleOpenChange(false)}
                type="button"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 touch-pan-y">
            {view === "flip" ? (
              <FlipCardGame
                onArcadeChange={refresh}
                onExit={() => {
                  refresh();
                  setView("list");
                }}
              />
            ) : view === "shop" ? (
              <ShopCatalog
                arcade={arcade}
                onBack={() => setView("list")}
                onSelect={(skin) => setPreviewSkin(skin)}
              />
            ) : (
              <div className="flex min-h-full flex-col">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-[#FFFDF9] to-[#F7F2EA] p-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F2ECE4] text-[#8B7355]">
                        <Boxes className="size-5" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold leading-none text-stone-800">
                            {t("game.flip.title")}
                          </p>
                          <button
                            className={ticketClass}
                            disabled={startDisabled}
                            onClick={startFlip}
                            type="button"
                          >
                            <Ticket
                              className="size-3.5 shrink-0 text-[#8B7355]"
                              strokeWidth={2}
                            />
                            <span className="leading-none">{startLabel}</span>
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs leading-snug text-stone-400">
                          {t("game.flip.desc")}
                        </p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-none text-stone-500">
                          <span className="inline-flex items-center gap-1">
                            <Target
                              className="size-3 shrink-0 text-amber-600"
                              strokeWidth={2}
                            />
                            <span className="leading-none">
                              {freeLeft > 0
                                ? t("game.arcade.freeReady", {
                                    n: freeLeft,
                                    max: FREE_PLAYS_PER_DAY,
                                  })
                                : t("game.arcade.freeUsed")}
                            </span>
                          </span>
                          <span aria-hidden className="text-stone-300">
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Gift
                              className="size-3 shrink-0 text-amber-600"
                              strokeWidth={2}
                            />
                            <span className="leading-none">
                              {t("game.arcade.winReward", { n: WIN_POINTS })}
                            </span>
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <ComingSoonCard title={t("game.scratch.title")} />
                    <ComingSoonCard title={t("game.catch.title")} />
                  </div>

                  <section className="pt-1">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <p className="flex items-center text-sm font-semibold text-stone-800">
                        <Palette
                          className="mr-1.5 inline size-4 text-amber-700"
                          strokeWidth={2}
                        />
                        {t("game.shop.title")}
                      </p>
                      <button
                        className="inline-flex items-center gap-0.5 text-xs text-stone-400 transition-colors hover:text-stone-600"
                        onClick={() => setView("shop")}
                        type="button"
                      >
                        {t("game.shop.viewAll")}
                        <ChevronRight className="size-3.5" strokeWidth={2} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {SHOP_PREVIEWS.map((item) => {
                        const unlocked = arcade.unlockedSkins.includes(item.id);
                        return (
                          <button
                            className="flex h-full flex-col items-center rounded-xl border border-stone-200/70 bg-white p-3 text-center shadow-2xs transition-all hover:border-amber-200/80 active:scale-[0.98]"
                            key={item.id}
                            onClick={() => setPreviewSkin(item)}
                            type="button"
                          >
                            <span className="flex h-12 w-full items-center justify-center">
                              <SkinMiniPreview id={item.id} />
                            </span>
                            <span className="mt-2 line-clamp-2 min-h-[2.25rem] w-full text-[11px] font-medium leading-snug text-stone-700">
                              {t(item.nameKey)}
                            </span>
                            <span className="mt-auto inline-flex min-h-[1.25rem] items-center justify-center rounded-md bg-[#F2ECE4] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-stone-500">
                              {unlocked
                                ? t("game.shop.owned")
                                : t("game.shop.cost", { n: item.points })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-stone-200/60 pt-3 text-xs text-stone-500">
                  <span className="flex min-w-0 items-center gap-1">
                    <Sparkles
                      className="size-3.5 shrink-0 text-amber-600"
                      strokeWidth={2}
                    />
                    <span className="leading-snug">
                      {t("game.arcade.earnHint")}
                    </span>
                  </span>
                  <button
                    className="shrink-0 cursor-pointer font-medium text-amber-800 hover:underline"
                    onClick={navigateToQuickAdd}
                    type="button"
                  >
                    {t("game.arcade.goRecord")}
                  </button>
                </div>
              </div>
            )}

            {previewSkin ? (
              <SkinPreviewDialog
                canRedeem={canRedeem}
                owned={owned}
                pointsDiff={pointsDiff}
                skin={previewSkin}
                onClose={() => setPreviewSkin(null)}
                onEarnMore={() => {
                  setPreviewSkin(null);
                  setView("list");
                }}
                onRedeem={handleRedeem}
              />
            ) : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function ShopCatalog({
  arcade,
  onBack,
  onSelect,
}: {
  arcade: GameArcadeView;
  onBack: () => void;
  onSelect: (skin: ShopSkin) => void;
}) {
  const t = useT();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button
          aria-label={t("common.back")}
          className="grid size-8 shrink-0 place-items-center rounded-full text-stone-400 transition-colors hover:bg-stone-200/50 hover:text-stone-600"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <div className="min-w-0">
          <p className="flex items-center text-sm font-semibold text-stone-800">
            <Palette
              className="mr-1.5 inline size-4 text-amber-700"
              strokeWidth={2}
            />
            {t("game.shop.catalogTitle")}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {t("game.shop.catalogHint", { n: arcade.gamePoints })}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {SHOP_PREVIEWS.map((item) => {
          const unlocked = arcade.unlockedSkins.includes(item.id);
          return (
            <button
              className="flex w-full items-center gap-3 rounded-xl border border-stone-200/70 bg-white p-3 text-left shadow-2xs transition-all hover:border-amber-200/80 active:scale-[0.99]"
              key={item.id}
              onClick={() => onSelect(item)}
              type="button"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#FDFBF7]">
                <SkinMiniPreview id={item.id} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-800">
                  {t(item.nameKey)}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-[11px] leading-relaxed text-stone-400">
                  {t(item.descKey)}
                </span>
              </span>
              <span className="inline-flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-md bg-[#F2ECE4] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-stone-500">
                  {unlocked
                    ? t("game.shop.owned")
                    : t("game.shop.cost", { n: item.points })}
                </span>
                <ChevronRight
                  className="size-3.5 text-stone-300"
                  strokeWidth={2}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SkinMiniPreview({ id }: { id: ShopSkin["id"] }) {
  const t = useT();
  if (id === "bubble-caramel") {
    return (
      <span className="rounded-lg border border-amber-200/70 bg-amber-50/90 px-2 py-1 text-[10px] font-medium leading-none text-amber-900/90 shadow-2xs">
        {t("game.shop.previewBubble")}
      </span>
    );
  }
  if (id === "river-shades") {
    return (
      <span className="grid size-10 place-items-center rounded-full bg-[#F5E6D3]/80">
        <Glasses className="size-5 text-amber-800/90" strokeWidth={2} />
      </span>
    );
  }
  return (
    <span
      className="text-sm font-bold leading-none text-amber-900/90"
      style={{ fontFamily: "Georgia, 'Times New Roman', cursive, serif" }}
    >
      {t("game.shop.previewFont")}
    </span>
  );
}

function SkinPreviewDialog({
  skin,
  owned,
  canRedeem,
  pointsDiff,
  onClose,
  onRedeem,
  onEarnMore,
}: {
  skin: ShopSkin;
  owned: boolean;
  canRedeem: boolean;
  pointsDiff: number;
  onClose: () => void;
  onRedeem: () => void;
  onEarnMore: () => void;
}) {
  const t = useT();

  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center bg-black/25 px-4 pb-6 pt-10 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-bold text-stone-800">
              {t(skin.nameKey)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              {t(skin.descKey)}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="grid size-7 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-2xl border border-amber-200/50 bg-gradient-to-br from-[#FFFDF9] to-[#F7F2EA] p-4">
          <SkinLargePreview id={skin.id} />
        </div>

        <p className="mt-3 text-center text-[11px] text-stone-400">
          {t("game.shop.cost", { n: skin.points })}
        </p>

        <div className="mt-3">
          {owned ? (
            <button
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-stone-100 text-sm font-medium text-stone-500"
              disabled
              type="button"
            >
              <Check className="size-4" strokeWidth={2} />
              {t("game.shop.owned")}
            </button>
          ) : canRedeem ? (
            <button
              className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-200 to-amber-300 text-sm font-semibold text-amber-950 shadow-xs transition-all hover:from-amber-300 hover:to-amber-400 active:scale-[0.98]"
              onClick={onRedeem}
              type="button"
            >
              {t("game.shop.redeemNow")}
            </button>
          ) : (
            <button
              className="flex h-11 w-full items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 text-sm font-medium text-amber-900 transition-all hover:bg-amber-100/80 active:scale-[0.98]"
              onClick={onEarnMore}
              type="button"
            >
              {t("game.shop.needMore", { n: pointsDiff })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SkinLargePreview({ id }: { id: ShopSkin["id"] }) {
  const t = useT();
  if (id === "bubble-caramel") {
    return (
      <div className="relative max-w-[220px]">
        <div className="rounded-2xl border border-amber-300/70 bg-amber-100/80 px-4 py-3 text-sm font-medium text-amber-950 shadow-sm">
          {t("game.shop.previewBubbleChat")}
        </div>
        <div className="absolute -bottom-1 left-5 size-2.5 rotate-45 border-b border-r border-amber-300/70 bg-amber-100/80" />
      </div>
    );
  }
  if (id === "river-shades") {
    return (
      <div className="relative">
        <CatAvatar className="size-20 drop-shadow-sm" size={80} />
        <span className="absolute left-1/2 top-[42%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#F5E6D3]/90 px-2 py-1 shadow-xs">
          <Glasses className="size-7 text-amber-900" strokeWidth={2.25} />
        </span>
      </div>
    );
  }
  return (
    <div className="text-center">
      <p
        className="text-3xl font-bold tracking-wide text-amber-900"
        style={{ fontFamily: "Georgia, 'Times New Roman', cursive, serif" }}
      >
        {t("game.shop.previewFont")}
      </p>
      <p className="mt-2 text-[11px] text-stone-400">
        {t("game.shop.previewFontHint")}
      </p>
    </div>
  );
}

function ComingSoonCard({ title }: { title: string }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-stone-200/40 bg-stone-100/50 p-3 opacity-60">
      <span className="flex min-w-0 items-center gap-1.5">
        <Lock className="size-4 shrink-0 text-stone-400" strokeWidth={2} />
        <span className="truncate text-xs font-medium text-stone-500">
          {title}
        </span>
      </span>
      <span className="shrink-0 text-[10px] text-stone-400">
        {t("game.arcade.comingSoon")}
      </span>
    </div>
  );
}
