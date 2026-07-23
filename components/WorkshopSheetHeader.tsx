"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/components/LocaleProvider";

/** 喵喵工坊系列 BottomSheet 共用内容区内边距 */
export const WORKSHOP_SHEET_CONTENT =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] touch-pan-y";

/** 喵喵工坊系列 BottomSheet 面板背景 */
export const WORKSHOP_SHEET_PANEL = "bg-[var(--color-bg-main)]";

/**
 * 统一顶栏：左图标 + text-sm 粗体标题，无底部分割线；右侧可挂胶囊，末尾关闭。
 */
export function WorkshopSheetHeader({
  icon,
  title,
  trailing,
  onClose,
}: {
  icon: ReactNode;
  title: string;
  trailing?: ReactNode;
  onClose?: () => void;
}) {
  const t = useT();

  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-1">
      <div className="flex min-w-0 items-center">
        <span className="mr-1.5 inline-flex shrink-0 items-center text-amber-700 [&_svg]:size-4">
          {icon}
        </span>
        <span className="truncate text-sm font-bold text-[var(--color-text-main)]">
          {title}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {trailing}
        {onClose ? (
          <button
            aria-label={t("common.close")}
            className="grid size-7 shrink-0 place-items-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-text-body)] active:scale-95"
            onClick={onClose}
            type="button"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
