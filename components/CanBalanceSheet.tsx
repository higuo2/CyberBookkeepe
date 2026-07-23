"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Gamepad2,
  Gift,
  Heart,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { CatAvatar } from "@/components/CatAvatar";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import {
  WORKSHOP_SHEET_CONTENT,
  WORKSHOP_SHEET_PANEL,
  WorkshopSheetHeader,
} from "@/components/WorkshopSheetHeader";
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
    <BottomSheet
      contentClassName={WORKSHOP_SHEET_CONTENT}
      header={
        <WorkshopSheetHeader
          icon={<CatCanIcon className="text-[#A68B6A]" />}
          onClose={() => onOpenChange(false)}
          title={t("can.drawer.title")}
        />
      }
      onOpenChange={onOpenChange}
      open={open}
      panelClassName={WORKSHOP_SHEET_PANEL}
      title={t("can.drawer.title")}
    >
      <div className="rounded-2xl border border-[#EDE4D8] bg-gradient-to-br from-[#FFFDF9] to-[#F8F3EC] p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div
            className={`shrink-0 ${avatarBump ? "river-avatar-wobble" : ""}`}
          >
            <CatAvatar className="size-12 drop-shadow-sm" size={48} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-numeric text-2xl font-bold text-stone-800">
              {state.cans_count}
              <span className="ml-1 text-sm font-semibold text-stone-500">
                {t("can.drawer.unit")}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
              {full ? t("can.drawer.stockFull") : t("can.drawer.stockEmpty")}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-stone-600">
          {full ? t("can.drawer.statusFull") : t("can.drawer.statusEmpty")}
        </p>

        <button
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#D9C4B0] bg-white py-2.5 text-xs font-bold text-[#634225] shadow-2xs transition-all hover:bg-amber-50/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!full}
          onClick={handleFeed}
          type="button"
        >
          <Sparkles className="size-3.5 text-amber-600" strokeWidth={2} />
          {t("can.drawer.feed")}
        </button>
      </div>

      <p className="mb-1.5 mt-4 flex items-center text-[11px] font-medium text-stone-500">
        <Gift className="mr-1 inline size-3.5 text-stone-400" strokeWidth={2} />
        {t("can.drawer.howtoTitle")}
      </p>
      <div className="overflow-hidden rounded-2xl border border-[#EDE6DC] bg-white shadow-2xs">
        <button
          className="flex w-full cursor-pointer items-center justify-between border-b border-[#F5EFE6] p-3 text-left transition-colors last:border-none hover:bg-[#FAF7F2]"
          onClick={() => closeThen(onGoCheckin)}
          type="button"
        >
          <span className="flex min-w-0 items-center text-xs font-medium text-stone-800">
            <Calendar
              className="mr-2 inline size-3.5 shrink-0 text-amber-700"
              strokeWidth={2}
            />
            {t("can.drawer.taskCheckin")}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-900/70">
            {t("can.drawer.taskCheckinAction")}
            <ChevronRight className="size-3.5" strokeWidth={2} />
          </span>
        </button>

        <button
          className="flex w-full cursor-pointer items-center justify-between border-b border-[#F5EFE6] p-3 text-left transition-colors last:border-none hover:bg-[#FAF7F2]"
          onClick={() => closeThen(onGoArcade)}
          type="button"
        >
          <span className="flex min-w-0 items-center text-xs font-medium text-stone-800">
            <Gamepad2
              className="mr-2 inline size-3.5 shrink-0 text-amber-700"
              strokeWidth={2}
            />
            {t("game.arcade.title")}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-900/70">
            {t("can.drawer.taskArcadeAction")}
            <ChevronRight className="size-3.5" strokeWidth={2} />
          </span>
        </button>
      </div>

      <button
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#8C5D33] to-[#734722] px-4 py-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-[#794E29] hover:to-[#633B1A] active:scale-[0.98]"
        onClick={() => closeThen(onGoTip)}
        type="button"
      >
        <Heart
          className="size-4 fill-rose-300/30 text-rose-300"
          strokeWidth={2}
        />
        {t("can.drawer.goTip")}
        <ChevronRight className="size-4 text-amber-200/70" strokeWidth={2} />
      </button>
    </BottomSheet>
  );
}
