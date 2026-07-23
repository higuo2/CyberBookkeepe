"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import {
  CAN_STATE_EVENT,
  readCanState,
  type CanEconomyState,
} from "@/lib/can-system";

export function CanBalanceSheet({
  open,
  onOpenChange,
  onGoTip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 关闭本抽屉并打开赏罐头入口 */
  onGoTip: () => void;
}) {
  const t = useT();
  const [state, setState] = useState<CanEconomyState>(() => readCanState());

  useEffect(() => {
    if (!open) return;
    setState(readCanState());
    const onUpdate = () => setState(readCanState());
    window.addEventListener(CAN_STATE_EVENT, onUpdate);
    return () => window.removeEventListener(CAN_STATE_EVENT, onUpdate);
  }, [open]);

  const full = state.cans_count > 0;

  function handleGoTip() {
    onOpenChange(false);
    window.setTimeout(() => onGoTip(), 220);
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

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/60 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
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

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 touch-pan-y">
            <div className="rounded-2xl border border-[#E8E0D5]/80 bg-white/70 p-5 text-center shadow-xs">
              <p className="font-numeric text-4xl font-bold tracking-tight text-stone-800">
                {state.cans_count}
                <span className="ml-1 text-base font-semibold text-stone-500">
                  {t("can.drawer.unit")}
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-stone-400">
                {t("can.drawer.stockHint")}
              </p>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-stone-600">
              {full
                ? t("can.drawer.statusFull")
                : t("can.drawer.statusEmpty")}
            </p>

            <p className="mt-4 text-[11px] leading-relaxed text-stone-400">
              {t("can.drawer.hint")}
            </p>
          </div>

          {/* Footer action */}
          <div className="shrink-0 border-t border-stone-200/60 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <button
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#C4A484] text-sm font-bold text-white shadow-sm transition-all hover:bg-[#B89572] active:scale-[0.98]"
              onClick={handleGoTip}
              type="button"
            >
              {t("can.drawer.goTip")}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
