"use client";

import { Check, Flame } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { CatCanIcon } from "@/components/icons/CatCanIcon";
import { useT } from "@/components/LocaleProvider";
import type { CanEconomyState } from "@/lib/can-system";

function streakCycleProgress(streak: number) {
  if (streak <= 0) return 0;
  return streak % 7 === 0 ? 7 : streak % 7;
}

export function CheckinRulesModal({
  open,
  onOpenChange,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: CanEconomyState;
}) {
  const t = useT();
  const lit = streakCycleProgress(state.checkin_streak);
  const frags = Math.min(3, Math.max(0, state.can_fragments));

  return (
    <BottomSheet
      header={
        <div className="flex items-center gap-2 px-5 pb-2">
          <Flame
            className="size-5 shrink-0 fill-[var(--color-primary)]/20 text-[var(--color-primary)]"
            strokeWidth={2}
          />
          <p className="text-lg font-extrabold text-[var(--color-text-main)]">
            {t("can.checkin.rulesTitle")}
          </p>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      panelClassName="bg-[var(--color-bg-main)]"
    >
      <div className="space-y-4 pb-2 pt-1">
        <div className="space-y-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="flex items-start gap-2.5 text-sm leading-6 text-[var(--color-text-main)] opacity-80">
            <CatCanIcon className="mt-0.5 size-4 shrink-0 text-[var(--color-primary)]" />
            <span>{t("can.checkin.rulesBody")}</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm leading-6 text-[var(--color-text-main)] opacity-80">
            <CatCanIcon className="mt-0.5 size-4 shrink-0 text-[var(--color-primary)]" />
            <span>{t("can.checkin.fragmentRecipe")}</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm leading-6 text-[var(--color-text-main)] opacity-80">
            <Flame
              className="mt-0.5 size-4 shrink-0 fill-[var(--color-primary)]/20 text-[var(--color-primary)]"
              strokeWidth={2}
            />
            <span>{t("can.checkin.streakHint")}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--color-text-main)]">
            {t("can.checkin.streakTitle")}
          </p>
          <div className="mt-3 flex items-center justify-between gap-1.5">
            {Array.from({ length: 7 }, (_, i) => {
              const done = i < lit;
              return (
                <span
                  key={i}
                  className={`grid size-8 place-items-center rounded-full text-[10px] font-bold transition-all ${
                    done
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-dashed border-[var(--color-border)] text-[var(--color-text-main)] opacity-40"
                  }`}
                >
                  {done ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    i + 1
                  )}
                </span>
              );
            })}
          </div>
          <p className="mt-2.5 font-numeric text-xs text-[var(--color-text-main)] opacity-60">
            {t("can.checkin.streak", { days: state.checkin_streak })}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-main)]">
              <CatCanIcon className="size-3.5 text-[var(--color-primary)]" />
              {t("can.checkin.fragmentsLabel")}
            </p>
            <p className="font-numeric text-xs text-[var(--color-text-main)] opacity-60">
              {frags}/3
            </p>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-main)] opacity-60">
            {t("can.checkin.fragmentHint")}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--color-bg-soft)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${(frags / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
