"use client";

import { useEffect, useState } from "react";
import { Check, LockKeyhole, Palette } from "lucide-react";
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
  readCanState,
  restoreSavedTheme,
  unlockAndApplyTheme,
  type CanEconomyState,
} from "@/lib/can-system";
import { STORE_THEMES, type ThemeId } from "@/lib/cream-theme";
import type { MessageKey } from "@/lib/i18n";

/** 莫兰迪低饱和色卡索引（仅预览，非实色主题 token） */
const THEME_DOTS: Record<ThemeId, [string, string, string]> = {
  cream: ["#FAF5EF", "#E3D8C8", "#8C5A3C"],
  titanium: ["#2B2D31", "#41444A", "#8A99AD"],
  cyber: ["#212338", "#403853", "#D96B87"],
  matcha: ["#F0F4EF", "#C5D5C4", "#587058"],
  sky: ["#F0F5F9", "#B8CBD9", "#5B7E9C"],
};

export function ThemeStoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  function handleOpenChange(next: boolean) {
    if (!next) restoreSavedTheme();
    onOpenChange(next);
  }

  function onApply(id: ThemeId) {
    if (state.current_theme === id) return;
    const result = unlockAndApplyTheme(id);
    setState(result.state);
    if (!result.ok) {
      toast.error(t(result.messageKey as MessageKey));
      return;
    }
    toast.success(t(result.messageKey as MessageKey));
  }

  return (
    <BottomSheet
      contentClassName={WORKSHOP_SHEET_CONTENT}
      header={
        <WorkshopSheetHeader
          icon={<Palette strokeWidth={2} />}
          onClose={() => handleOpenChange(false)}
          title={t("can.storeTitle")}
          trailing={
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E8DFC2] bg-[#F5EFE6] px-2 py-1 text-[10px] font-medium text-[var(--color-text-body)]">
              <CatCanIcon className="size-3 shrink-0 text-amber-700" />
              <span className="font-numeric leading-none">
                {t("can.balanceShort", { cans: state.cans_count })}
              </span>
            </span>
          }
        />
      }
      onOpenChange={handleOpenChange}
      open={open}
      panelClassName={WORKSHOP_SHEET_PANEL}
      title={t("can.storeTitle")}
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xs divide-y divide-[var(--color-border)]/40">
          {STORE_THEMES.map((theme) => {
            const dots = THEME_DOTS[theme.id];
            const unlocked = state.unlocked_themes.includes(theme.id);
            const isCurrent = state.current_theme === theme.id;
            const canAfford = state.cans_count >= theme.cost;

            return (
              <button
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors active:bg-[var(--color-text-main)]/5"
                key={theme.id}
                onClick={() => onApply(theme.id)}
                type="button"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-sm font-semibold text-[var(--color-text-main)]">
                    {theme.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {dots.map((color) => (
                      <span
                        className="size-[20px] shrink-0 rounded-full border border-black/5"
                        key={`${theme.id}-${color}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="shrink-0">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
                      <Check className="size-4" strokeWidth={2.5} />
                      <span>{t("can.theme.inUse")}</span>
                    </span>
                  ) : unlocked ? (
                    <span className="text-xs font-medium text-[var(--color-text-main)] opacity-40 transition-opacity">
                      {t("can.theme.applyShort")}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-main)] ${
                        canAfford ? "opacity-50" : "opacity-30"
                      }`}
                    >
                      <CatCanIcon className="size-3.5 text-[var(--color-primary)]" />
                      <span className="font-numeric">{theme.cost}</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold text-[var(--color-text-main)] opacity-40">
            {t("can.teaser.title")}
          </p>
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg-card)] shadow-sm divide-y divide-[var(--color-border)]/40">
            {[t("can.teaser.avatar"), t("can.teaser.tone")].map((label) => (
              <div
                className="flex w-full items-center gap-2 px-4 py-3 text-xs text-[var(--color-text-main)] opacity-40"
                key={label}
              >
                <LockKeyhole className="size-3.5 shrink-0" strokeWidth={2} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
