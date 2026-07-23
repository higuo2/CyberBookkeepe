"use client";

import { useEffect, useState } from "react";
import { Cat, Heart } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import {
  CAN_STATE_EVENT,
  claimSponsorCans,
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
  const [qrReady, setQrReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState(readCanState());
    setCode("");
    setQrReady(false);
    const onUpdate = () => setState(readCanState());
    window.addEventListener(CAN_STATE_EVENT, onUpdate);
    return () => window.removeEventListener(CAN_STATE_EVENT, onUpdate);
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCode("");
      setQrReady(false);
    }
    onOpenChange(next);
  }

  function onSponsorClaim() {
    const result = claimSponsorCans();
    setState(result.state);
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
      header={
        <div className="flex items-center justify-between gap-3 px-5 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <Heart
              className="size-5 shrink-0 text-[var(--color-primary)]"
              strokeWidth={2}
            />
            <p className="truncate text-lg font-extrabold text-[var(--color-text-main)]">
              {t("can.sponsor.title")}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-main)]">
            <CatCanIcon className="size-3.5 text-[var(--color-primary)]" />
            {t("can.balanceShort", { cans: state.cans_count })}
          </span>
        </div>
      }
      onOpenChange={handleOpenChange}
      open={open}
    >
      <div className="space-y-4 pb-2 pt-1">
        <p className="text-sm leading-6 text-[var(--color-text-main)] opacity-70">
          {t("can.sponsor.intro")}
        </p>

        <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-soft)] px-4 py-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className={`size-40 rounded-xl object-contain ${qrReady ? "block" : "hidden"}`}
            onError={() => setQrReady(false)}
            onLoad={() => setQrReady(true)}
            src="/icons/tip-qr.png"
          />
          {!qrReady ? (
            <div className="flex flex-col items-center gap-3 text-[var(--color-text-main)] opacity-70">
              <div className="grid size-32 place-items-center rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)]/50">
                <Cat className="size-12" strokeWidth={1.5} />
              </div>
              <p className="max-w-[240px] text-center text-xs leading-5">
                {t("can.sponsor.qrPlaceholder")}
              </p>
            </div>
          ) : null}
        </div>

        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary)] text-sm font-semibold text-white transition-all active:scale-[0.98]"
          onClick={onSponsorClaim}
          type="button"
        >
          <CatCanIcon className="size-4" />
          {t("can.sponsor.claim")}
        </button>

        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--color-text-main)] opacity-60">
            {t("can.code.label")}
          </p>
          <div className="flex gap-2">
            <input
              className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 text-sm text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)]"
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("can.code.placeholder")}
              value={code}
            />
            <button
              className="h-11 shrink-0 rounded-2xl bg-[var(--color-text-main)] px-4 text-sm font-semibold text-[var(--color-bg-card)] transition-all active:scale-[0.98]"
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
