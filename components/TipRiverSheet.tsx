"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Heart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import {
  WORKSHOP_SHEET_CONTENT,
  WORKSHOP_SHEET_PANEL,
  WorkshopSheetHeader,
} from "@/components/WorkshopSheetHeader";
import {
  CAN_STATE_EVENT,
  claimSponsorCans,
  hasClaimedSponsorToday,
  readCanState,
  redeemCode,
  type CanEconomyState,
} from "@/lib/can-system";
import type { MessageKey } from "@/lib/i18n";

export function TipRiverSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [state, setState] = useState<CanEconomyState>(() => readCanState());
  const [code, setCode] = useState("");
  const claimedToday = hasClaimedSponsorToday(state);

  useEffect(() => {
    if (!open) return;
    setState(readCanState());
    setCode("");
    const onUpdate = () => setState(readCanState());
    window.addEventListener(CAN_STATE_EVENT, onUpdate);
    return () => window.removeEventListener(CAN_STATE_EVENT, onUpdate);
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) setCode("");
    onOpenChange(next);
  }

  function onSponsorClaim() {
    if (hasClaimedSponsorToday()) return;
    const result = claimSponsorCans();
    setState(result.state);
    if (!result.ok) {
      toast.message(t(result.messageKey as MessageKey));
      return;
    }
    toast.success(t("can.sponsor.thanks"));
  }

  function onRedeem() {
    const result = redeemCode(code);
    setState(result.state);
    if (!result.ok) {
      toast.error(t(result.messageKey as MessageKey));
      return;
    }
    setCode("");
    toast.success(t("can.code.success", { count: result.cansAdded }));
  }

  return (
    <BottomSheet
      contentClassName={WORKSHOP_SHEET_CONTENT}
      header={
        <WorkshopSheetHeader
          icon={<Heart strokeWidth={2} />}
          onClose={() => handleOpenChange(false)}
          title={t("can.sponsor.title")}
          trailing={
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E8DFC2] bg-[#F5EFE6] px-2 py-1 text-[10px] font-medium text-[var(--color-text-body)]">
              <CatCanIcon className="size-3 shrink-0 text-amber-700" />
              <span className="leading-none">
                {t("can.balanceShort", { cans: state.cans_count })}
              </span>
            </span>
          }
        />
      }
      onOpenChange={handleOpenChange}
      open={open}
      panelClassName={WORKSHOP_SHEET_PANEL}
      title={t("can.sponsor.title")}
    >
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
          {t("can.sponsor.intro")}
        </p>

        <div className="text-center">
          <span className="mb-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600">
            <CheckCircle2 className="size-3" strokeWidth={2} />
            {t("can.sponsor.wechatPay")}
          </span>

          <div className="mx-auto flex h-44 w-44 flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={t("can.sponsor.qrAlt")}
              className="h-36 w-36 object-contain"
              src="/icons/tip-qr-clean.png"
            />
          </div>

          <p className="mt-2.5 flex items-center justify-center gap-1 text-center text-[11px] text-[var(--color-text-muted)]">
            <Sparkles
              className="size-3 shrink-0 text-amber-500"
              strokeWidth={2}
            />
            {t("can.sponsor.qrHint")}
          </p>
        </div>

        {claimedToday ? (
          <button
            className="w-full cursor-not-allowed rounded-xl bg-[var(--color-bg-soft)] py-3 text-xs font-medium text-[var(--color-text-muted)]"
            disabled
            type="button"
          >
            {t("can.sponsor.alreadyToday")}
          </button>
        ) : (
          <button
            className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 py-3 text-xs font-medium text-white shadow-xs transition-all hover:from-amber-700 hover:to-amber-800 active:scale-[0.98]"
            onClick={onSponsorClaim}
            type="button"
          >
            <Heart className="mr-1 inline size-3.5" strokeWidth={2} />
            {t("can.sponsor.claim")}
          </button>
        )}

        <div className="mt-3 border-t border-[var(--color-border)]/50 pt-3">
          <p className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">
            {t("can.code.label")}
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2 text-xs text-[var(--color-text-main)] outline-none focus:border-amber-400"
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("can.code.placeholder")}
              value={code}
            />
            <button
              className="whitespace-nowrap rounded-xl bg-[var(--color-text-main)] px-4 py-2 text-xs font-medium text-[var(--color-bg-card)] transition-colors hover:opacity-90 active:scale-[0.98]"
              onClick={onRedeem}
              type="button"
            >
              {t("can.code.submit")}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
