"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Gamepad2,
  Gift,
  Heart,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { CatAvatar } from "@/components/CatAvatar";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import {
  CAN_STATE_EVENT,
  feedRiverOneCan,
  readCanState,
  type CanEconomyState,
} from "@/lib/can-system";

export function CanBalanceSheet({
  open,
  onOpenChange,
  onGoTip,
  onGoCheckin,
  onGoArcade,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 关闭本抽屉并打开赏罐头入口 */
  onGoTip: () => void;
  /** 关闭本抽屉并打开打卡说明 */
  onGoCheckin: () => void;
  /** 关闭本抽屉并打开喵喵游乐场 */
  onGoArcade: () => void;
}) {
  const t = useT();
  const [state, setState] = useState<CanEconomyState>(() => readCanState());
  const [avatarBump, setAvatarBump] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState(readCanState());
    const onUpdate = () => setState(readCanState());
    window.addEventListener(CAN_STATE_EVENT, onUpdate);
    return () => window.removeEventListener(CAN_STATE_EVENT, onUpdate);
  }, [open]);

  const full = state.cans_count > 0;

  function closeThen(next: () => void) {
    onOpenChange(false);
    window.setTimeout(next, 220);
  }

  function handleFeed() {
    const result = feedRiverOneCan();
    setState(result.state);
    if (!result.ok) {
      toast.error(t(result.messageKey));
      return;
    }
    setAvatarBump(true);
    window.setTimeout(() => setAvatarBump(false), 450);
    toast.success(t(result.messageKey), { duration: 2200 });
  }

  return (
    <Drawer.Root direction="left" onOpenChange={onOpenChange} open={open}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px]" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-[90] flex h-full w-[min(320px,85vw)] flex-col bg-[#FDFBF7] outline-none shadow-2xl"
        >
          <Drawer.Title className="sr-only">{t("can.drawer.title")}</Drawer.Title>

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/50 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-2">
              <CatCanIcon className="size-5 shrink-0 text-[#A68B6A]" />
              <p className="truncate text-base font-bold text-stone-800">
                {t("can.drawer.title")}
              </p>
            </div>
            <button
              aria-label={t("common.close")}
              className="grid size-8 shrink-0 place-items-center rounded-full text-stone-400 transition-colors hover:bg-stone-200/50 hover:text-stone-600 active:scale-95"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 touch-pan-y">
            {/* River 互动大卡片 */}
            <div className="mb-4 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-[#FFFDF9] to-[#F7F2EA] p-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div
                  className={`shrink-0 ${
                    avatarBump ? "river-avatar-wobble" : ""
                  }`}
                >
                  <CatAvatar
                    className="size-14 drop-shadow-sm"
                    size={56}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-numeric text-3xl font-bold text-stone-800">
                    {state.cans_count}
                    <span className="ml-1 text-base font-semibold text-stone-500">
                      {t("can.drawer.unit")}
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    {full
                      ? t("can.drawer.stockFull")
                      : t("can.drawer.stockEmpty")}
                  </p>
                </div>
              </div>

              <p className="my-3 text-xs leading-relaxed text-stone-600">
                {full
                  ? t("can.drawer.statusFull")
                  : t("can.drawer.statusEmpty")}
              </p>

              <button
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200/80 bg-white py-2.5 text-xs font-semibold text-amber-900 shadow-2xs transition-all hover:bg-amber-50/80 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!full}
                onClick={handleFeed}
                type="button"
              >
                <Sparkles
                  className="size-3.5 text-amber-600"
                  strokeWidth={2}
                />
                {t("can.drawer.feed")}
              </button>
            </div>

            {/* 统一任务清单 */}
            <p className="mb-2 flex items-center text-xs font-medium text-stone-500">
              <Gift className="mr-1 inline size-4 text-stone-400" strokeWidth={2} />
              {t("can.drawer.howtoTitle")}
            </p>
            <div className="overflow-hidden rounded-xl border border-stone-200/70 bg-white shadow-2xs divide-y divide-stone-100">
              <button
                className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition-colors hover:bg-stone-50/80 active:bg-stone-50"
                onClick={() => closeThen(onGoCheckin)}
                type="button"
              >
                <span className="flex min-w-0 items-center text-xs font-medium text-stone-700">
                  <Calendar
                    className="mr-2 inline size-4 shrink-0 text-amber-700"
                    strokeWidth={2}
                  />
                  {t("can.drawer.taskCheckin")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-amber-800">
                  {t("can.drawer.taskCheckinAction")}
                  <ChevronRight className="size-3.5" strokeWidth={2} />
                </span>
              </button>

              <button
                className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition-colors hover:bg-stone-50/80 active:bg-stone-50"
                onClick={() => closeThen(onGoArcade)}
                type="button"
              >
                <span className="flex min-w-0 items-center text-xs font-medium text-stone-700">
                  <Gamepad2
                    className="mr-2 inline size-4 shrink-0 text-amber-700"
                    strokeWidth={2}
                  />
                  {t("game.arcade.title")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-stone-400">
                  {t("can.drawer.taskArcadeAction")}
                  <ChevronRight className="size-3.5" strokeWidth={2} />
                </span>
              </button>
            </div>
          </div>

          <div className="shrink-0 border-t border-stone-200/50 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-200 to-amber-300 py-3 text-sm font-medium text-amber-950 shadow-xs transition-all hover:from-amber-300 hover:to-amber-400 active:scale-[0.98]"
              onClick={() => closeThen(onGoTip)}
              type="button"
            >
              <Heart
                className="size-4 fill-amber-800 text-amber-800"
                strokeWidth={2}
              />
              {t("can.drawer.goTip")}
              <ChevronRight className="size-4" strokeWidth={2} />
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
